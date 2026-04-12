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

function validateBrackets(brackets: TaxBracket[]): void {
  if (!brackets || brackets.length === 0) {
    throw new TaxError('Brackets must not be empty');
  }
  if (brackets[0].min !== 0) {
    throw new TaxError('First bracket must start at 0');
  }
  if (brackets[brackets.length - 1].max !== Infinity) {
    throw new TaxError('Last bracket must end at Infinity');
  }
  for (let i = 1; i < brackets.length; i++) {
    if (brackets[i].min !== brackets[i - 1].max) {
      throw new TaxError('Brackets must be contiguous and sorted by min');
    }
  }
}

function computeBracketTax(
  income: number,
  brackets: TaxBracket[]
): {
  total: number;
  breakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[];
} {
  const breakdown: { bracket: TaxBracket; taxableInBracket: number; taxForBracket: number }[] = [];
  let total = 0;

  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const upperBound = bracket.max === Infinity ? income : bracket.max;
    const taxableInBracket = Math.min(income, upperBound) - bracket.min;
    const taxForBracket = round2(taxableInBracket * bracket.rate);
    breakdown.push({ bracket, taxableInBracket, taxForBracket });
    total += taxForBracket;
  }

  return { total, breakdown };
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
  validateBrackets(config.brackets.single);
  validateBrackets(config.brackets.joint);

  const monthlyIncomes = new Map<number, number>();
  const monthBracketsOverride = new Map<number, { single: TaxBracket[]; joint: TaxBracket[] }>();
  let filingStatus: FilingStatus = 'single';
  const deductions: Deduction[] = [];
  const credits: TaxCredit[] = [];

  function getBracketsForMonth(month: number): { single: TaxBracket[]; joint: TaxBracket[] } {
    return monthBracketsOverride.get(month) ?? config.brackets;
  }

  return {
    setIncome(month: number, amount: number): void {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new TaxError('Month must be between 1 and 12');
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
      deductions.push(deduction);
    },

    addCredit(credit: TaxCredit): void {
      if (credit.amount < 0) {
        throw new TaxError('Credit amount must be >= 0');
      }
      credits.push(credit);
    },

    adjustBrackets(
      brackets: { single: TaxBracket[]; joint: TaxBracket[] },
      fromMonth: number
    ): void {
      if (!Number.isInteger(fromMonth) || fromMonth < 1 || fromMonth > 12) {
        throw new TaxError('fromMonth must be between 1 and 12');
      }
      validateBrackets(brackets.single);
      validateBrackets(brackets.joint);
      for (let month = fromMonth; month <= 12; month++) {
        monthBracketsOverride.set(month, brackets);
      }
    },

    calculate(): TaxResult {
      const grossIncome = Array.from(monthlyIncomes.values()).reduce((a, b) => a + b, 0);

      // Collect deductions by type
      const otherDeductions = deductions
        .filter(d => d.type === 'other')
        .reduce((sum, d) => sum + d.amount, 0);

      const totalMedicalExpenses = deductions
        .filter(d => d.type === 'medical')
        .reduce((sum, d) => sum + d.amount, 0);

      // Fixed-point iteration for medical deductions
      // AGI = grossIncome - otherDeductions - medicalDeduction
      let medicalDeduction = 0;
      let agi = Math.max(0, grossIncome - otherDeductions);

      if (totalMedicalExpenses > 0) {
        let converged = false;
        for (let iter = 0; iter < 100; iter++) {
          const floor = config.medicalDeductionFloorRate * agi;
          const newMedicalDeduction = Math.max(0, totalMedicalExpenses - floor);

          if (Math.abs(newMedicalDeduction - medicalDeduction) < 0.01) {
            medicalDeduction = newMedicalDeduction;
            agi = Math.max(0, grossIncome - otherDeductions - medicalDeduction);
            converged = true;
            break;
          }

          medicalDeduction = newMedicalDeduction;
          agi = Math.max(0, grossIncome - otherDeductions - medicalDeduction);
        }

        if (!converged) {
          throw new TaxError('Medical deduction fixed-point iteration did not converge after 100 iterations');
        }
      }

      // Standard deduction with phaseout
      const baseStandardDeduction = config.standardDeduction[filingStatus];
      const phaseoutStart = config.standardDeductionPhaseoutStart[filingStatus];
      let standardDeductionAmount = baseStandardDeduction;

      if (grossIncome > phaseoutStart) {
        const excess = grossIncome - phaseoutStart;
        const reduction = Math.ceil(excess / 1000) * 50;
        standardDeductionAmount = Math.max(0, baseStandardDeduction - reduction);
      }

      // Choose greater of standard or itemized deductions
      const itemizedTotal = otherDeductions + medicalDeduction;
      const useStandard = standardDeductionAmount >= itemizedTotal;
      const deductionUsed = useStandard ? standardDeductionAmount : itemizedTotal;

      // Taxable income is never negative
      const taxableIncome = Math.max(0, agi - deductionUsed);

      // Regular tax using year-end (month 12) brackets
      const yearEndBrackets = getBracketsForMonth(12)[filingStatus];
      const { total: regularTax, breakdown: bracketBreakdown } = computeBracketTax(taxableIncome, yearEndBrackets);

      // AMT calculation
      // Add back standard deduction if it was used; itemized deductions are not added back
      const amtIncome = taxableIncome + (useStandard ? standardDeductionAmount : 0);
      const baseAmtExemption = config.amtExemption[filingStatus];
      const amtPhaseoutStart = config.amtPhaseoutStart[filingStatus];
      const exemptionPhaseoutReduction = Math.max(0, amtIncome - amtPhaseoutStart) * 0.25;
      const amtExemption = Math.max(0, baseAmtExemption - exemptionPhaseoutReduction);
      const amtTaxableIncome = Math.max(0, amtIncome - amtExemption);

      let amt = 0;
      if (amtTaxableIncome > 0) {
        const { lowRate, lowRateMax, highRate } = config.amtRates;
        if (amtTaxableIncome <= lowRateMax) {
          amt = round2(amtTaxableIncome * lowRate);
        } else {
          amt = round2(lowRateMax * lowRate + (amtTaxableIncome - lowRateMax) * highRate);
        }
      }

      // Apply credits: non-refundable first (capped at 0), then refundable
      const nonRefundableTotal = credits
        .filter(c => !c.refundable)
        .reduce((sum, c) => sum + c.amount, 0);