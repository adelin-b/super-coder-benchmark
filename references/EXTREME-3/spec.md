# EXTREME-3: Tax Bracket Calculator with Retroactive Adjustments

## Overview
Implement a progressive income tax calculator that supports multiple filing statuses, retroactive bracket changes mid-year, standard and itemized deductions with phaseout rules, tax credits, and an Alternative Minimum Tax (AMT) calculation. The system must handle rounding at each bracket boundary independently, deduction phaseout, and a circular dependency in medical expense deductions that requires fixed-point iteration.

## Exported API

```ts
export type FilingStatus = 'single' | 'joint';

export interface TaxBracket {
  min: number;       // lower bound of bracket (inclusive)
  max: number;       // upper bound of bracket (exclusive), Infinity for top bracket
  rate: number;      // decimal rate, e.g. 0.10 for 10%
}

export interface Deduction {
  id: string;
  type: 'standard' | 'medical' | 'other';
  amount: number;
}

export interface TaxCredit {
  id: string;
  amount: number;
  refundable: boolean;   // refundable credits can make tax negative (refund)
}

export interface TaxResult {
  grossIncome: number;
  adjustedGrossIncome: number;
  taxableIncome: number;
  regularTax: number;
  amt: number;                    // Alternative Minimum Tax calculation
  finalTax: number;               // max(regularTax, amt) - credits
  totalCredits: number;
  effectiveRate: number;          // finalTax / grossIncome (0 if grossIncome is 0)
  bracketBreakdown: {
    bracket: TaxBracket;
    taxableInBracket: number;
    taxForBracket: number;        // rounded to 2 decimal places independently
  }[];
}

export interface MonthlyTax {
  month: number;               // 1-12
  income: number;
  cumulativeIncome: number;
  cumulativeTax: number;
  brackets: TaxBracket[];      // brackets in effect for this month
}

export interface TaxCalculatorConfig {
  brackets: { single: TaxBracket[]; joint: TaxBracket[] };
  standardDeduction: { single: number; joint: number };
  standardDeductionPhaseoutStart: { single: number; joint: number };
  amtExemption: { single: number; joint: number };
  amtPhaseoutStart: { single: number; joint: number };
  amtRates: { lowRate: number; lowRateMax: number; highRate: number };
  medicalDeductionFloorRate: number;   // e.g. 0.075 for 7.5%
}

export class TaxError extends Error {}

export function createTaxCalculator(config: TaxCalculatorConfig): {
  /** Set income for a specific month (1-12). */
  setIncome(month: number, amount: number): void;

  /** Set filing status. Default is 'single'. */
  setFilingStatus(status: FilingStatus): void;

  /** Add a deduction. */
  addDeduction(deduction: Deduction): void;

  /** Add a tax credit. */
  addCredit(credit: TaxCredit): void;

  /**
   * Change brackets retroactively starting from a specific month.
   * All months from `fromMonth` through 12 use the new brackets.
   * Previous months keep their original brackets.
   */
  adjustBrackets(brackets: { single: TaxBracket[]; joint: TaxBracket[] }, fromMonth: number): void;

  /** Calculate full-year tax result. */
  calculate(): TaxResult;

  /** Get month-by-month breakdown. */
  getMonthlyBreakdown(): MonthlyTax[];
};
```

## Detailed Requirements

### Progressive Bracket Calculation
Income is taxed progressively: only the portion of income within each bracket is taxed at that bracket's rate.

**Critical**: Tax for EACH bracket is rounded to 2 decimal places (cents) INDEPENDENTLY before summing. This means:
```
bracket1_tax = round2(income_in_bracket_1 * rate_1)
bracket2_tax = round2(income_in_bracket_2 * rate_2)
total_tax = bracket1_tax + bracket2_tax
```
This gives a DIFFERENT result than `round2(income_in_bracket_1 * rate_1 + income_in_bracket_2 * rate_2)`.

Rounding uses standard rounding (round half up): `Math.round(x * 100) / 100`.

### Filing Status
- `'single'` and `'joint'` have different bracket thresholds.
- Joint thresholds are derived from single thresholds with multipliers:
  - Brackets where single max <= $50,000: joint threshold = single threshold * 1.8
  - Brackets where single max > $50,000: joint threshold = single threshold * 1.6
  - The top bracket (max = Infinity) always has max = Infinity for both statuses.

Note: The config provides BOTH single and joint brackets directly. The multiplier rule above is how the default config's joint brackets are derived, but `adjustBrackets` provides explicit brackets for both statuses.

### Retroactive Bracket Adjustments
`adjustBrackets(newBrackets, fromMonth)` changes the brackets used for months `fromMonth` through 12.

- `fromMonth` must be between 1 and 12.
- Each month's income is taxed using the brackets in effect for that month.
- The annual calculation annualizes: each month's income is multiplied by 12, taxed using that month's brackets, then divided by 12 to get the monthly tax.
- `getMonthlyBreakdown()` shows which brackets were in effect for each month.
- Calling `adjustBrackets` multiple times for overlapping periods: the latest call wins for each month.

### Standard Deduction
- Subtracted from gross income before bracket calculation.
- **Phaseout**: if gross income exceeds `standardDeductionPhaseoutStart`, the standard deduction is reduced by $50 for every $1,000 (or fraction thereof) above the threshold.
- The standard deduction cannot go below $0.
- If the taxpayer has itemized deductions (type !== 'standard'), they choose the GREATER of standard deduction (after phaseout) or total itemized deductions.

### Medical Expense Deduction (Circular Dependency)
Medical expenses are only deductible above `medicalDeductionFloorRate` (e.g., 7.5%) of AGI.

AGI = grossIncome - deductions (excluding standard deduction, which is separate).

The circular dependency: adding a medical deduction reduces AGI, which raises the floor, which may eliminate the deduction.

**Resolution**: Iterate to fixed point:
1. Start with AGI = grossIncome - nonMedicalDeductions.
2. Compute medical deduction = max(0, medicalExpenses - medicalDeductionFloorRate * AGI).
3. Recompute AGI = grossIncome - nonMedicalDeductions - medicalDeduction.
4. Repeat steps 2-3 until the medical deduction stabilizes (change < $0.01).
5. Maximum 100 iterations; throw TaxError if no convergence.

### Tax Credits
Applied AFTER bracket calculation (after computing regular tax).

- **Non-refundable credits**: can reduce tax to $0 but NOT below. Applied first.
- **Refundable credits**: can reduce tax below $0 (resulting in a refund). Applied after non-refundable.

### Alternative Minimum Tax (AMT)
A parallel tax calculation:
1. Start with taxable income (same as regular).
2. Add back certain deductions (for simplicity: standard deduction is added back, itemized deductions are NOT added back).
3. Subtract AMT exemption. The exemption phases out: reduced by $0.25 for every $1 above `amtPhaseoutStart`.
4. Apply AMT rates: `lowRate` on income up to `lowRateMax`, `highRate` on income above.
5. If AMT > regular tax, the taxpayer pays AMT instead.

`finalTax = max(regularTax, amt) - credits`

Credits are applied to whichever tax is higher, subject to the same refundable/non-refundable rules.

### Monthly Breakdown
- `getMonthlyBreakdown()` returns tax info for each month 1-12.
- Each month's tax is calculated by annualizing: `monthlyTax = yearlyTax(monthIncome * 12, bracketsForMonth) / 12`.
- `cumulativeTax` is the running sum of monthly taxes.
- Months with no income set have income = 0.

### Validation
- Month must be 1-12 for `setIncome` and `adjustBrackets`.
- Income must be >= 0.
- Deduction amount must be >= 0.
- Credit amount must be >= 0.
- Brackets must be sorted by min, contiguous, start at 0, and end at Infinity.
- Filing status must be 'single' or 'joint'.
- Throw `TaxError` on validation failures.

### Edge Cases
- Zero income: all taxes are 0, effective rate is 0.
- Income exactly at a bracket boundary: the boundary amount is in the lower bracket.
- Deductions exceeding income: taxable income is 0, not negative.
- Standard deduction fully phased out: deduction becomes 0.
- AMT exemption fully phased out: no exemption.
- All credits are non-refundable and exceed tax: final tax is 0.
- Refundable credits exceed tax: final tax is negative (refund).

## Invariants
1. Tax for each bracket, when summed, equals regularTax (within rounding).
2. effectiveRate = finalTax / grossIncome (0 if no income).
3. Taxable income is never negative.
4. Non-refundable credits never make tax negative; only refundable credits can.
5. Monthly breakdown sums should approximate annual calculation (may differ due to annualization).
6. AMT >= 0 always.
7. Standard deduction after phaseout is >= 0.
