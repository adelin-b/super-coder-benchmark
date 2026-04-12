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
  constructor(message: string) {
    super(message);
    this.name = 'TaxError';
    Object.setPrototypeOf(this, TaxError.prototype);
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function computeProgressiveTax(
  income: number,
  brackets: TaxBracket[]
): {
  regularTax: number;
  bracketBreakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[];
} {
  const breakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[] = [];
  let regularTax = 0;

  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const upperBound = bracket.max === Infinity ? income : Math.min(income, bracket.max);
    const taxableInBracket = upperBound - bracket.min;
    const taxForBracket = round2(taxableInBracket * bracket.rate);
    breakdown.push({ bracket, taxableInBracket, taxForBracket });
    regularTax += taxForBracket;
  }

  return { regularTax, bracketBreakdown: breakdown };
}

function validateBrackets(brackets: { single: TaxBracket[]; joint: TaxBracket[] }): void {
  for (const status of ['single', 'joint'] as const) {
    const brs = brackets[status];
    if (!brs || brs.length === 0) {
      throw new TaxError(`Brackets for '${status}' cannot be empty`);
    }
    if (brs[0].min !== 0) {
      throw new TaxError(`Brackets for '${status}' must start at 0`);
    }
    if (brs[brs.length - 1].max !== Infinity) {
      throw new TaxError(`Top bracket for '${status}' must end at Infinity`);
    }
    for (let i = 1; i < brs.length; i++) {
      if (brs[i].min !== brs[i - 1].max) {
        throw new TaxError(`Brackets for '${status}' must be contiguous`);
      }
    }
    for (const br of brs) {
      if (br.min < 0) {
        throw new TaxError(`Bracket min must be >= 0`);
      }
    }
  }
}

export function createTaxCalculator(config: TaxCalculatorConfig): {
  setIncome(month: number, amount: number): void;
  setFilingStatus(status: FilingStatus): void;
  addDeduction(deduction: Deduction): void;
  addCredit(credit: TaxCredit): void;
  adjustBrackets(brackets: { single: TaxBracket[]; joint: TaxBracket[] }, fromMonth: number): void;
  calculate(): TaxResult;
  getMonthlyBreakdown(): MonthlyTax[];
} {
  let filingStatus: FilingStatus = 'single';
  const monthlyIncomes = new Map<number, number>();
  const deductions: Deduction[] = [];
  const credits: TaxCredit[] = [];
  const monthBracketOverrides = new Map<number, { single: TaxBracket[]; joint: TaxBracket[] }>();

  function getBracketsForMonth(month: number): TaxBracket[] {
    const override = monthBracketOverrides.get(month);
    const src = override ?? config.brackets;
    return filingStatus === 'single' ? src.single : src.joint;
  }

  function computeStdDeduction(grossIncome: number): number {
    const base = config.standardDeduction[filingStatus];
    const phaseoutStart = config.standardDeductionPhaseoutStart[filingStatus];
    if (grossIncome <= phaseoutStart) return base;
    const excess = grossIncome - phaseoutStart;
    const units = Math.ceil(excess / 1000);
    return Math.max(0, base - units * 50);
  }

  function computeAMT(taxableIncome: number, stdDeductionAddback: number): number {
    const amtIncome = taxableIncome + stdDeductionAddback;
    const exemption = config.amtExemption[filingStatus];
    const phaseoutStart = config.amtPhaseoutStart[filingStatus];

    let adjustedExemption = exemption;
    if (amtIncome > phaseoutStart) {
      adjustedExemption = Math.max(0, exemption - 0.25 * (amtIncome - phaseoutStart));
    }

    const amtBase = Math.max(0, amtIncome - adjustedExemption);
    const { lowRate, lowRateMax, highRate } = config.amtRates;

    let amt: number;
    if (amtBase <= lowRateMax) {
      amt = amtBase * lowRate;
    } else {
      amt = lowRateMax * lowRate + (amtBase - lowRateMax) * highRate;
    }

    return Math.max(0, amt);
  }

  function applyCredits(taxBase: number): { finalTax: number; totalCredits: number } {
    let remaining = taxBase;
    let totalCredits = 0;

    // Non-refundable credits first — cannot reduce below 0
    for (const credit of credits.filter((c) => !c.refundable)) {
      const applied = Math.min(credit.amount, Math.max(0, remaining));
      totalCredits += applied;
      remaining -= applied;
    }

    // Refundable credits — can go below 0
    for (const credit of credits.filter((c) => c.refundable)) {
      totalCredits += credit.amount;
      remaining -= credit.amount;
    }

    return { finalTax: remaining, totalCredits };
  }

  return {
    setIncome(month: number, amount: number): void {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new TaxError('Month must be an integer between 1 and 12');
      }
      if (amount < 0) {
        throw new TaxError('Income must be >= 0');
      }
      monthlyIncomes.set(month, amount);
    },

    setFilingStatus(status: FilingStatus): void {
      if (status !== 'single' && status !== 'joint') {
        throw new TaxError("Filing status must be 'single' or 'joint'");
      }
      filingStatus = status;
    },

    addDeduction(deduction: Deduction): void {
      if (deduction.amount < 0) {
        throw new TaxError('Deduction amount must be >= 0');
      }
      deductions.push({ ...deduction });
    },

    addCredit(credit: TaxCredit): void {
      if (credit.amount < 0) {
        throw new TaxError('Credit amount must be >= 0');
      }
      credits.push({ ...credit });
    },

    adjustBrackets(
      newBrackets: { single: TaxBracket[]; joint: TaxBracket[] },
      fromMonth: number
    ): void {
      if (!Number.isInteger(fromMonth) || fromMonth < 1 || fromMonth > 12) {
        throw new TaxError('fromMonth must be an integer between 1 and 12');
      }
      validateBrackets(newBrackets);
      for (let m = fromMonth; m <= 12; m++) {
        monthBracketOverrides.set(m, newBrackets);
      }
    },

    calculate(): TaxResult {
      const grossIncome = Array.from(monthlyIncomes.values()).reduce((a, b) => a + b, 0);

      // Partition deductions by type
      const medicalExpenses = deductions
        .filter((d) => d.type === 'medical')
        .reduce((a, d) => a + d.amount, 0);
      const otherDeductionsTotal = deductions
        .filter((d) => d.type === 'other')
        .reduce((a, d) => a + d.amount, 0);

      // Fixed-point iteration for circular medical deduction dependency
      // Initial AGI excludes medical (unknown yet)
      let medicalDeduction = 0;
      let agi = Math.max(0, grossIncome - otherDeductionsTotal);
      let converged = false;

      for (let iter = 0; iter < 100; iter++) {
        const newMedical = Math.max(
          0,
          medicalExpenses - config.medicalDeductionFloorRate * agi
        );
        if (Math.abs(newMedical - medicalDeduction) < 0.01) {
          medicalDeduction = newMedical;
          converged = true;
          break;
        }
        medicalDeduction = newMedical;
        agi = Math.max(0, grossIncome - otherDeductionsTotal - medicalDeduction);
      }

      if (!converged) {
        throw new TaxError(
          'Medical deduction calculation did not converge after 100 iterations'
        );
      }

      // Final AGI after convergence
      const adjustedGrossIncome = Math.max(
        0,
        grossIncome - otherDeductionsTotal - medicalDeduction
      );

      // Standard deduction (after phaseout)
      const stdDed = computeStdDeduction(grossIncome);

      // Total itemized = medical (deductible portion) + other
      const totalItemized = medicalDeduction + otherDeductionsTotal;

      // Choose the greater deduction
      const useStandard = stdDed >= totalItemized;
      const deductionUsed = useStandard ? stdDed : totalItemized;

      const taxableIncome = Math.max(0, grossIncome - deductionUsed);

      // Use the brackets in effect for month 12 as the effective annual brackets
      const effectiveBrackets = getBracketsForMonth(12);
      const { regularTax, bracketBreakdown } = computeProgressiveTax(
        taxableIncome,
        effectiveBrackets
      );

      // AMT: add back standard deduction only when standard was chosen
      const stdDeductionAddback = useStandard ? stdDed : 0;
      const amt = computeAMT(taxableIncome, stdDeductionAddback);

      // finalTax = max(regularTax, amt) minus credits
      const taxBeforeCredits = Math.max(regularTax, amt);
      const { finalTax, totalCredits } = applyCredits(taxBeforeCredits);

      const effectiveRate = grossIncome === 0 ? 0 : finalTax / grossIncome;

      return {
        grossIncome,
        adjustedGrossIncome,
        taxableIncome,
        regularTax,
        amt,
        finalTax,
        totalCredits,
        effectiveRate,
        bracketBreakdown,
      };
    },

    getMonthlyBreakdown(): MonthlyTax[] {
      const result: MonthlyTax[] = [];
      let cumulativeIncome = 0;
      let cumulativeTax = 0;

      for (let month = 1; month <= 12; month++) {
        const income = monthlyIncomes.get(month) ?? 0;
        const brackets = getBracketsForMonth(month);

        // Annualize: tax on (income * 12) then divide by 12
        const annualized = income * 12;
        const { regularTax } = computeProgressiveTax(annualized, brackets);
        const monthTax = regularTax / 12;

        cumulativeIncome += income;
        cumulativeTax += monthTax;

        result.push({
          month,
          income,
          cumulativeIncome,
          cumulativeTax,
          brackets,
        });
      }

      return result;
    },
  };
}