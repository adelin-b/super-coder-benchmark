export type FilingStatus = 'single' | 'joint';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface Deduction {
  id: string;
  type: 'standard' | 'medical' | 'other';
  amount: number;
}

export interface TaxCredit {
  id: string;
  amount: number;
  refundable: boolean;
}

export interface TaxResult {
  grossIncome: number;
  adjustedGrossIncome: number;
  taxableIncome: number;
  regularTax: number;
  amt: number;
  finalTax: number;
  totalCredits: number;
  effectiveRate: number;
  bracketBreakdown: {
    bracket: TaxBracket;
    taxableInBracket: number;
    taxForBracket: number;
  }[];
}

export interface MonthlyTax {
  month: number;
  income: number;
  cumulativeIncome: number;
  cumulativeTax: number;
  brackets: TaxBracket[];
}

export interface TaxCalculatorConfig {
  brackets: { single: TaxBracket[]; joint: TaxBracket[] };
  standardDeduction: { single: number; joint: number };
  standardDeductionPhaseoutStart: { single: number; joint: number };
  amtExemption: { single: number; joint: number };
  amtPhaseoutStart: { single: number; joint: number };
  amtRates: { lowRate: number; lowRateMax: number; highRate: number };
  medicalDeductionFloorRate: number;
}

export class TaxError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TaxError';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function validateBrackets(brackets: TaxBracket[]): void {
  if (brackets.length === 0) throw new TaxError('Brackets must not be empty');
  if (brackets[0].min !== 0) throw new TaxError('Brackets must start at 0');
  if (brackets[brackets.length - 1].max !== Infinity) throw new TaxError('Last bracket must have max = Infinity');
  for (let i = 0; i < brackets.length; i++) {
    if (brackets[i].min >= brackets[i].max) throw new TaxError('Bracket min must be < max');
    if (i > 0 && brackets[i].min !== brackets[i - 1].max) {
      throw new TaxError('Brackets must be contiguous');
    }
  }
}

function computeTaxForBrackets(taxableIncome: number, brackets: TaxBracket[]): {
  total: number;
  breakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[];
} {
  const breakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[] = [];
  let total = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) {
      breakdown.push({ bracket, taxableInBracket: 0, taxForBracket: 0 });
      continue;
    }
    const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    const taxForBracket = round2(incomeInBracket * bracket.rate);
    total += taxForBracket;
    breakdown.push({ bracket, taxableInBracket: incomeInBracket, taxForBracket });
  }

  return { total, breakdown };
}

export function createTaxCalculator(config: TaxCalculatorConfig) {
  validateBrackets(config.brackets.single);
  validateBrackets(config.brackets.joint);

  const monthlyIncome = new Map<number, number>();
  let filingStatus: FilingStatus = 'single';
  const deductions: Deduction[] = [];
  const credits: TaxCredit[] = [];
  const bracketOverrides = new Map<number, { single: TaxBracket[]; joint: TaxBracket[] }>();

  function getBracketsForMonth(month: number): TaxBracket[] {
    const override = bracketOverrides.get(month);
    const allBrackets = override ?? config.brackets;
    return allBrackets[filingStatus];
  }

  function getGrossIncome(): number {
    let total = 0;
    for (const [, amount] of monthlyIncome) total += amount;
    return total;
  }

  function computeStandardDeduction(grossIncome: number): number {
    const baseDeduction = config.standardDeduction[filingStatus];
    const phaseoutStart = config.standardDeductionPhaseoutStart[filingStatus];
    if (grossIncome <= phaseoutStart) return baseDeduction;
    const excess = grossIncome - phaseoutStart;
    const reductionUnits = Math.ceil(excess / 1000);
    const reduction = reductionUnits * 50;
    return Math.max(0, baseDeduction - reduction);
  }

  function computeDeductions(grossIncome: number): { totalDeduction: number; agi: number } {
    const standardDed = computeStandardDeduction(grossIncome);
    const medicalDeductions = deductions.filter(d => d.type === 'medical');
    const otherItemized = deductions.filter(d => d.type === 'other');
    const totalMedicalExpenses = medicalDeductions.reduce((s, d) => s + d.amount, 0);
    const totalOtherItemized = otherItemized.reduce((s, d) => s + d.amount, 0);
    const hasItemized = medicalDeductions.length > 0 || otherItemized.length > 0;

    if (!hasItemized) {
      const agi = Math.max(0, grossIncome - standardDed);
      return { totalDeduction: standardDed, agi };
    }

    let medicalDeduction = 0;
    let prevMedicalDeduction = -1;
    let iterations = 0;

    while (Math.abs(medicalDeduction - prevMedicalDeduction) >= 0.01 && iterations < 100) {
      prevMedicalDeduction = medicalDeduction;
      const currentAGI = grossIncome - totalOtherItemized - medicalDeduction;
      const medicalFloor = config.medicalDeductionFloorRate * currentAGI;
      medicalDeduction = Math.max(0, totalMedicalExpenses - medicalFloor);
      iterations++;
    }

    if (iterations >= 100 && Math.abs(medicalDeduction - prevMedicalDeduction) >= 0.01) {
      throw new TaxError('Medical deduction calculation did not converge');
    }

    const totalItemized = totalOtherItemized + medicalDeduction;
    const chosenDeduction = Math.max(standardDed, totalItemized);
    const agi = Math.max(0, grossIncome - chosenDeduction);
    return { totalDeduction: chosenDeduction, agi };
  }

  function computeAMT(taxableIncome: number, grossIncome: number, usedStandardDeduction: boolean): number {
    let amtIncome = taxableIncome;
    if (usedStandardDeduction) {
      amtIncome += computeStandardDeduction(grossIncome);
    }
    const baseExemption = config.amtExemption[filingStatus];
    const phaseoutStart = config.amtPhaseoutStart[filingStatus];
    let exemption = baseExemption;
    if (amtIncome > phaseoutStart) {
      exemption = Math.max(0, baseExemption - (amtIncome - phaseoutStart) * 0.25);
    }
    const amtTaxableIncome = Math.max(0, amtIncome - exemption);
    const { lowRate, lowRateMax, highRate } = config.amtRates;
    if (amtTaxableIncome <= lowRateMax) {
      return round2(amtTaxableIncome * lowRate);
    }
    return round2(lowRateMax * lowRate) + round2((amtTaxableIncome - lowRateMax) * highRate);
  }

  function applyCredits(tax: number): { finalTax: number; totalCredits: number } {
    let remaining = tax;
    let totalCredits = 0;
    for (const credit of credits.filter(c => !c.refundable)) {
      const applied = Math.min(credit.amount, Math.max(0, remaining));
      remaining -= applied;
      totalCredits += applied;
    }
    remaining = Math.max(0, remaining);
    for (const credit of credits.filter(c => c.refundable)) {
      remaining -= credit.amount;
      totalCredits += credit.amount;
    }
    return { finalTax: round2(remaining), totalCredits: round2(totalCredits) };
  }

  return {
    setIncome(month: number, amount: number): void {
      if (month < 1 || month > 12 || !Number.isInteger(month))
        throw new TaxError('Month must be an integer between 1 and 12');
      if (amount < 0) throw new TaxError('Income must be >= 0');
      monthlyIncome.set(month, amount);
    },

    setFilingStatus(status: FilingStatus): void {
      if (status !== 'single' && status !== 'joint')
        throw new TaxError('Filing status must be "single" or "joint"');
      filingStatus = status;
    },

    addDeduction(deduction: Deduction): void {
      if (deduction.amount < 0) throw new TaxError('Deduction amount must be >= 0');
      deductions.push({ ...deduction });
    },

    addCredit(credit: TaxCredit): void {
      if (credit.amount < 0) throw new TaxError('Credit amount must be >= 0');
      credits.push({ ...credit });
    },

    adjustBrackets(brackets: { single: TaxBracket[]; joint: TaxBracket[] }, fromMonth: number): void {
      if (fromMonth < 1 || fromMonth > 12 || !Number.isInteger(fromMonth))
        throw new TaxError('fromMonth must be an integer between 1 and 12');
      validateBrackets(brackets.single);
      validateBrackets(brackets.joint);
      for (let m = fromMonth; m <= 12; m++) {
        bracketOverrides.set(m, { single: [...brackets.single], joint: [...brackets.joint] });
      }
    },

    calculate(): TaxResult {
      const grossIncome = getGrossIncome();

      if (grossIncome === 0) {
        const refundableTotal = credits.filter(c => c.refundable).reduce((s, c) => s + c.amount, 0);
        const brackets = getBracketsForMonth(1);
        return {
          grossIncome: 0, adjustedGrossIncome: 0, taxableIncome: 0,
          regularTax: 0, amt: 0,
          finalTax: refundableTotal === 0 ? 0 : round2(-refundableTotal),
          totalCredits: round2(refundableTotal), effectiveRate: 0,
          bracketBreakdown: brackets.map(b => ({ bracket: b, taxableInBracket: 0, taxForBracket: 0 })),
        };
      }

      const { totalDeduction, agi } = computeDeductions(grossIncome);
      const taxableIncome = Math.max(0, grossIncome - totalDeduction);

      const standardDed = computeStandardDeduction(grossIncome);
      const hasItemized = deductions.some(d => d.type === 'medical' || d.type === 'other');
      const usedStandardDeduction = !hasItemized || standardDed >= totalDeduction;

      const hasOverrides = bracketOverrides.size > 0;
      let regularTax: number;
      let breakdown: TaxResult['bracketBreakdown'];

      if (!hasOverrides) {
        const result = computeTaxForBrackets(taxableIncome, getBracketsForMonth(1));
        regularTax = result.total;
        breakdown = result.breakdown;
      } else {
        const groupMap = new Map<string, { months: number[]; brackets: TaxBracket[] }>();
        for (let m = 1; m <= 12; m++) {
          const brackets = getBracketsForMonth(m);
          const key = JSON.stringify(brackets);
          if (!groupMap.has(key)) groupMap.set(key, { months: [], brackets });
          groupMap.get(key)!.months.push(m);
        }
        let totalTax = 0;
        for (const group of groupMap.values()) {
          let groupIncome = 0;
          for (const m of group.months) groupIncome += monthlyIncome.get(m) ?? 0;
          const fraction = grossIncome > 0 ? groupIncome / grossIncome : group.months.length / 12;
          totalTax += fraction * computeTaxForBrackets(taxableIncome, group.brackets).total;
        }
        regularTax = round2(totalTax);
        let bestGroup: { months: number[]; brackets: TaxBracket[] } | null = null;
        for (const group of groupMap.values()) {
          if (!bestGroup || group.months.length > bestGroup.months.length) bestGroup = group;
        }
        breakdown = computeTaxForBrackets(taxableIncome, bestGroup!.brackets).breakdown;
      }

      const amt = computeAMT(taxableIncome, grossIncome, usedStandardDeduction);
      const { finalTax, totalCredits } = applyCredits(Math.max(regularTax, amt));
      const effectiveRate = grossIncome > 0 ? round2((finalTax / grossIncome) * 10000) / 10000 : 0;

      return {
        grossIncome, adjustedGrossIncome: round2(agi), taxableIncome: round2(taxableIncome),
        regularTax: round2(regularTax), amt: round2(amt), finalTax, totalCredits, effectiveRate,
        bracketBreakdown: breakdown,
      };
    },

    getMonthlyBreakdown(): MonthlyTax[] {
      const grossIncome = getGrossIncome();
      const { totalDeduction } = computeDeductions(grossIncome);
      const result: MonthlyTax[] = [];
      let cumulativeIncome = 0;
      let cumulativeTax = 0;

      for (let m = 1; m <= 12; m++) {
        const income = monthlyIncome.get(m) ?? 0;
        const brackets = getBracketsForMonth(m);
        const annualized = income * 12;
        const annualizedTaxable = Math.max(0, annualized - totalDeduction);
        const { total } = computeTaxForBrackets(annualizedTaxable, brackets);
        const monthTax = round2(total / 12);
        cumulativeIncome += income;
        cumulativeTax = round2(cumulativeTax + monthTax);
        result.push({ month: m, income, cumulativeIncome, cumulativeTax, brackets: [...brackets] });
      }
      return result;
    },
  };
}