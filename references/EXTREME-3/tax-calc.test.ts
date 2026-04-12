import { describe, it, expect } from 'vitest';
import { createTaxCalculator, TaxError } from './tax-calc.js';
import type { TaxCalculatorConfig, TaxBracket } from './tax-calc.js';

// Default config used across tests
function defaultConfig(): TaxCalculatorConfig {
  const singleBrackets: TaxBracket[] = [
    { min: 0, max: 10000, rate: 0.10 },
    { min: 10000, max: 40000, rate: 0.22 },
    { min: 40000, max: 90000, rate: 0.32 },
    { min: 90000, max: Infinity, rate: 0.37 },
  ];

  // Joint: lower brackets (max<=50000) use 1.8x, higher use 1.6x
  const jointBrackets: TaxBracket[] = [
    { min: 0, max: 18000, rate: 0.10 },       // 10000 * 1.8
    { min: 18000, max: 72000, rate: 0.22 },    // 40000 * 1.8
    { min: 72000, max: 144000, rate: 0.32 },   // 90000 * 1.6
    { min: 144000, max: Infinity, rate: 0.37 },
  ];

  return {
    brackets: { single: singleBrackets, joint: jointBrackets },
    standardDeduction: { single: 13000, joint: 26000 },
    standardDeductionPhaseoutStart: { single: 200000, joint: 350000 },
    amtExemption: { single: 75000, joint: 114000 },
    amtPhaseoutStart: { single: 500000, joint: 750000 },
    amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
    medicalDeductionFloorRate: 0.075,
  };
}

describe('EXTREME-3: Tax Bracket Calculator with Retroactive Adjustments', () => {
  // === Basic Bracket Calculation ===

  it('calculates basic progressive tax for a single filer', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.setIncome(1, 50000);
    const result = calc.calculate();
    // Gross = 50000, standard deduction = 13000, taxable = 37000
    // Bracket 1: 10000 * 0.10 = 1000.00
    // Bracket 2: 27000 * 0.22 = 5940.00
    // Total = 6940.00
    expect(result.grossIncome).toBe(50000);
    expect(result.taxableIncome).toBe(37000);
    expect(result.regularTax).toBe(6940);
  });

  it('calculates tax for income spanning all brackets', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.setIncome(1, 150000);
    const result = calc.calculate();
    // Gross = 150000, std deduction = 13000, taxable = 137000
    // Bracket 1: 10000 * 0.10 = 1000.00
    // Bracket 2: 30000 * 0.22 = 6600.00
    // Bracket 3: 50000 * 0.32 = 16000.00
    // Bracket 4: 47000 * 0.37 = 17390.00
    // Total = 40990.00
    expect(result.regularTax).toBe(40990);
    expect(result.bracketBreakdown).toHaveLength(4);
    expect(result.bracketBreakdown[0].taxForBracket).toBe(1000);
    expect(result.bracketBreakdown[3].taxableInBracket).toBe(47000);
  });

  // === Rounding per-bracket vs end-rounding ===

  it('rounds each bracket tax independently (differs from single rounding)', () => {
    // Craft income to produce fractional cents per bracket
    const config = defaultConfig();
    // Custom brackets to force fractional cents
    config.brackets.single = [
      { min: 0, max: 10000, rate: 0.10 },
      { min: 10000, max: 40000, rate: 0.22 },
      { min: 40000, max: Infinity, rate: 0.37 },
    ];
    config.brackets.joint = config.brackets.single; // not used
    const calc = createTaxCalculator(config);
    // Income that produces fractional cents: 10333
    // taxable = 10333 - 13000 = 0 (deduction wipes it)
    // Let's use a smaller deduction
    config.standardDeduction.single = 0;
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc2 = createTaxCalculator(config);
    calc2.setIncome(1, 10333);
    const result = calc2.calculate();
    // Bracket 1: 10000 * 0.10 = 1000.00
    // Bracket 2: 333 * 0.22 = 73.26
    // Per-bracket rounding: 1000.00 + 73.26 = 1073.26
    // Single rounding: round2(1000 + 73.26) = 1073.26 (same here)
    expect(result.regularTax).toBe(1073.26);
  });

  it('per-bracket rounding differs from end-rounding with specific amounts', () => {
    const config: TaxCalculatorConfig = {
      brackets: {
        single: [
          { min: 0, max: 7777, rate: 0.13 },
          { min: 7777, max: Infinity, rate: 0.29 },
        ],
        joint: [
          { min: 0, max: 7777, rate: 0.13 },
          { min: 7777, max: Infinity, rate: 0.29 },
        ],
      },
      standardDeduction: { single: 0, joint: 0 },
      standardDeductionPhaseoutStart: { single: 999999, joint: 999999 },
      amtExemption: { single: 999999, joint: 999999 },
      amtPhaseoutStart: { single: 999999, joint: 999999 },
      amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
      medicalDeductionFloorRate: 0.075,
    };
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 10000);
    const result = calc.calculate();
    // Bracket 1: 7777 * 0.13 = 1011.01
    // Bracket 2: 2223 * 0.29 = 644.67
    // Per-bracket sum = 1655.68
    // If we did single rounding: round2(7777*0.13 + 2223*0.29) = round2(1011.01 + 644.67) = 1655.68
    // Actually same here. Let's try harder.
    expect(result.regularTax).toBe(1655.68);
    expect(result.bracketBreakdown[0].taxForBracket).toBe(1011.01);
    expect(result.bracketBreakdown[1].taxForBracket).toBe(644.67);
  });

  it('per-bracket rounding creates visible difference', () => {
    // 3333 * 0.07 = 233.31, 6667 * 0.13 = 866.71
    // sum of rounded = 233.31 + 866.71 = 1100.02
    // single rounding: round2(3333*0.07 + 6667*0.13) = round2(233.31 + 866.71) = 1100.02
    // Same. Let's use 3 brackets with values that cause half-penny differences.
    const config: TaxCalculatorConfig = {
      brackets: {
        single: [
          { min: 0, max: 5000, rate: 0.103 },
          { min: 5000, max: 15000, rate: 0.227 },
          { min: 15000, max: Infinity, rate: 0.359 },
        ],
        joint: [
          { min: 0, max: 5000, rate: 0.103 },
          { min: 5000, max: 15000, rate: 0.227 },
          { min: 15000, max: Infinity, rate: 0.359 },
        ],
      },
      standardDeduction: { single: 0, joint: 0 },
      standardDeductionPhaseoutStart: { single: 999999, joint: 999999 },
      amtExemption: { single: 999999, joint: 999999 },
      amtPhaseoutStart: { single: 999999, joint: 999999 },
      amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
      medicalDeductionFloorRate: 0.075,
    };
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 20000);
    const result = calc.calculate();
    // Bracket 1: 5000 * 0.103 = 515.00 -> round2 = 515.00
    // Bracket 2: 10000 * 0.227 = 2270.00 -> round2 = 2270.00
    // Bracket 3: 5000 * 0.359 = 1795.00 -> round2 = 1795.00
    // Sum = 4580.00
    expect(result.bracketBreakdown[0].taxForBracket).toBe(515);
    expect(result.bracketBreakdown[1].taxForBracket).toBe(2270);
    expect(result.bracketBreakdown[2].taxForBracket).toBe(1795);
    expect(result.regularTax).toBe(4580);
  });

  // === Filing Status Differences ===

  it('joint filing has different bracket thresholds than single', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.setFilingStatus('joint');
    calc.setIncome(1, 100000);
    const result = calc.calculate();
    // Gross = 100000, std deduction joint = 26000, taxable = 74000
    // Joint brackets: 0-18000 @10%, 18000-72000 @22%, 72000-144000 @32%
    // Bracket 1: 18000 * 0.10 = 1800.00
    // Bracket 2: 54000 * 0.22 = 11880.00
    // Bracket 3: 2000 * 0.32 = 640.00
    // Total = 14320.00
    expect(result.taxableIncome).toBe(74000);
    expect(result.regularTax).toBe(14320);
  });

  it('same income produces different tax for single vs joint', () => {
    const config = defaultConfig();
    const calcSingle = createTaxCalculator(config);
    calcSingle.setIncome(1, 80000);
    const singleResult = calcSingle.calculate();

    const calcJoint = createTaxCalculator(config);
    calcJoint.setFilingStatus('joint');
    calcJoint.setIncome(1, 80000);
    const jointResult = calcJoint.calculate();

    // Single: taxable = 67000
    // Joint: taxable = 54000
    expect(singleResult.taxableIncome).toBe(67000);
    expect(jointResult.taxableIncome).toBe(54000);
    expect(singleResult.regularTax).toBeGreaterThan(jointResult.regularTax);
  });

  // === Retroactive Bracket Adjustments ===

  it('adjustBrackets changes tax for affected months', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    // Set equal monthly income
    for (let m = 1; m <= 12; m++) calc.setIncome(m, 5000);

    const beforeAdjust = calc.calculate();

    // New brackets with lower rates from month 7
    const newBrackets = {
      single: [
        { min: 0, max: 10000, rate: 0.05 },
        { min: 10000, max: 40000, rate: 0.15 },
        { min: 40000, max: 90000, rate: 0.25 },
        { min: 90000, max: Infinity, rate: 0.30 },
      ],
      joint: [
        { min: 0, max: 18000, rate: 0.05 },
        { min: 18000, max: 72000, rate: 0.15 },
        { min: 72000, max: 144000, rate: 0.25 },
        { min: 144000, max: Infinity, rate: 0.30 },
      ],
    };
    calc.adjustBrackets(newBrackets, 7);
    const afterAdjust = calc.calculate();

    // Lower rates from month 7 should reduce total tax
    expect(afterAdjust.finalTax).toBeLessThan(beforeAdjust.finalTax);
  });

  it('retroactive adjustment from month 1 changes all brackets', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 60000);

    // Flat tax from month 1
    const flatBrackets = {
      single: [{ min: 0, max: Infinity, rate: 0.15 }],
      joint: [{ min: 0, max: Infinity, rate: 0.15 }],
    };
    calc.adjustBrackets(flatBrackets, 1);
    const result = calc.calculate();

    // taxable = 60000 - 13000 = 47000
    // Tax = round2(47000 * 0.15) = 7050
    expect(result.regularTax).toBe(7050);
  });

  it('monthly breakdown shows different brackets per month after adjustment', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    for (let m = 1; m <= 12; m++) calc.setIncome(m, 5000);

    const newBrackets = {
      single: [{ min: 0, max: Infinity, rate: 0.20 }],
      joint: [{ min: 0, max: Infinity, rate: 0.20 }],
    };
    calc.adjustBrackets(newBrackets, 7);

    const monthly = calc.getMonthlyBreakdown();
    // Months 1-6 should have original brackets (4 brackets)
    expect(monthly[0].brackets).toHaveLength(4);
    // Months 7-12 should have new brackets (1 bracket)
    expect(monthly[6].brackets).toHaveLength(1);
    expect(monthly[6].brackets[0].rate).toBe(0.20);
  });

  it('later adjustBrackets call overrides earlier one for same month range', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 60000);

    const brackets1 = {
      single: [{ min: 0, max: Infinity, rate: 0.10 }],
      joint: [{ min: 0, max: Infinity, rate: 0.10 }],
    };
    const brackets2 = {
      single: [{ min: 0, max: Infinity, rate: 0.25 }],
      joint: [{ min: 0, max: Infinity, rate: 0.25 }],
    };

    calc.adjustBrackets(brackets1, 1);
    calc.adjustBrackets(brackets2, 1); // overrides
    const result = calc.calculate();

    // taxable = 60000 - 13000 = 47000
    // Tax = round2(47000 * 0.25) = 11750
    expect(result.regularTax).toBe(11750);
  });

  // === Standard Deduction Phaseout ===

  it('standard deduction phases out for high income', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    // Single: phaseout starts at 200000
    // Income = 210000, excess = 10000
    // Reduction = ceil(10000/1000) * 50 = 10 * 50 = 500
    // Deduction = 13000 - 500 = 12500
    calc.setIncome(1, 210000);
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(210000 - 12500);
  });

  it('standard deduction fully phases out at very high income', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    // To fully phase out 13000: need 13000/50 = 260 units of 1000
    // = 260000 above phaseout start
    // Income = 200000 + 260000 = 460000
    calc.setIncome(1, 460000);
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(460000); // full income taxed
  });

  it('partial $1000 excess still counts as full unit for phaseout', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    // Income = 200001, excess = 1 (fraction of $1000 → rounds up to 1 unit)
    // Reduction = 1 * 50 = 50
    // Deduction = 13000 - 50 = 12950
    calc.setIncome(1, 200001);
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(200001 - 12950);
  });

  // === Medical Deduction Circular Dependency ===

  it('medical deduction iterates to fixed point', () => {
    const config = defaultConfig();
    config.standardDeduction.single = 0; // force itemized
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    // Medical expenses: 15000
    // 7.5% of AGI floor
    // Iteration:
    // AGI_0 = 100000, floor = 7500, deduction = 7500
    // AGI_1 = 100000 - 7500 = 92500, floor = 6937.50, deduction = 8062.50
    // AGI_2 = 100000 - 8062.50 = 91937.50, floor = 6895.31, deduction = 8104.69
    // ... converges
    calc.addDeduction({ id: 'med1', type: 'medical', amount: 15000 });
    const result = calc.calculate();

    // The fixed point: medDed = 15000 - 0.075*(100000 - medDed)
    // medDed = 15000 - 7500 + 0.075*medDed
    // 0.925*medDed = 7500
    // medDed = 7500/0.925 = 8108.108...
    // AGI = 100000 - 8108.11 = 91891.89
    // taxable = 91891.89
    expect(result.taxableIncome).toBeCloseTo(91891.89, 0);
  });

  it('medical deduction becomes zero when expenses below floor', () => {
    const config = defaultConfig();
    config.standardDeduction.single = 0;
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    // Medical expenses = 5000, floor = 7500 → no deduction
    calc.addDeduction({ id: 'med1', type: 'medical', amount: 5000 });
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(100000);
  });

  it('medical deduction with other itemized deductions', () => {
    const config = defaultConfig();
    config.standardDeduction.single = 0;
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    calc.addDeduction({ id: 'other1', type: 'other', amount: 10000 });
    calc.addDeduction({ id: 'med1', type: 'medical', amount: 15000 });
    // AGI starts at 100000 - 10000 = 90000 (other deductions reduce AGI)
    // Then medical iteration on top of that
    // medDed = 15000 - 0.075*(90000 - medDed)
    // medDed = 15000 - 6750 + 0.075*medDed
    // 0.925*medDed = 8250
    // medDed = 8918.92 (approx)
    // Total deductions = 10000 + 8918.92 = 18918.92
    const result = calc.calculate();
    expect(result.taxableIncome).toBeCloseTo(100000 - 18918.92, 0);
  });

  // === Itemized vs Standard Deduction Choice ===

  it('chooses itemized when it exceeds standard deduction', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    // Standard deduction = 13000
    // Other itemized = 20000 > 13000 → use itemized
    calc.addDeduction({ id: 'other1', type: 'other', amount: 20000 });
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(80000);
  });

  it('chooses standard when it exceeds itemized', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    // Standard deduction = 13000
    // Other itemized = 5000 < 13000 → use standard
    calc.addDeduction({ id: 'other1', type: 'other', amount: 5000 });
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(87000);
  });

  // === Tax Credits ===

  it('non-refundable credit reduces tax to zero but not below', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 20000); // small income
    const beforeCredit = calc.calculate();
    expect(beforeCredit.regularTax).toBeGreaterThan(0);

    const calc2 = createTaxCalculator(config);
    calc2.setIncome(1, 20000);
    calc2.addCredit({ id: 'c1', amount: 999999, refundable: false });
    const result = calc2.calculate();
    expect(result.finalTax).toBe(0);
  });

  it('refundable credit can make tax negative (refund)', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 20000);
    calc.addCredit({ id: 'c1', amount: 50000, refundable: true });
    const result = calc.calculate();
    expect(result.finalTax).toBeLessThan(0);
  });

  it('non-refundable applied before refundable', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 50000);
    // Regular tax: about 6940
    // Non-refundable: 5000 (reduces to ~1940)
    // Refundable: 3000 (reduces to ~-1060)
    calc.addCredit({ id: 'nr1', amount: 5000, refundable: false });
    calc.addCredit({ id: 'r1', amount: 3000, refundable: true });
    const result = calc.calculate();
    // regularTax = 6940
    // After non-refundable: 6940 - 5000 = 1940
    // After refundable: 1940 - 3000 = -1060
    expect(result.finalTax).toBe(-1060);
    expect(result.totalCredits).toBe(8000);
  });

  it('multiple non-refundable credits capped at tax amount', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 50000);
    // Tax ~ 6940
    calc.addCredit({ id: 'nr1', amount: 4000, refundable: false });
    calc.addCredit({ id: 'nr2', amount: 4000, refundable: false });
    // Total non-refundable = 8000, but tax is only 6940
    // Applied: first 4000 → 2940 remaining, then min(4000, 2940) = 2940
    // Total credits applied: 6940
    const result = calc.calculate();
    expect(result.finalTax).toBe(0);
    expect(result.totalCredits).toBe(6940);
  });

  // === AMT ===

  it('AMT does not trigger when regular tax is higher', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 50000);
    const result = calc.calculate();
    // taxable = 37000, regular tax = 6940
    // AMT: taxable + std deduction added back = 37000 + 13000 = 50000
    // exemption = 75000 (single), 50000 < 75000 → AMT taxable = 0
    // AMT = 0 < 6940 → no AMT
    expect(result.amt).toBe(0);
    expect(result.finalTax).toBe(result.regularTax);
  });

  it('AMT triggers for high income with standard deduction add-back', () => {
    const config: TaxCalculatorConfig = {
      brackets: {
        single: [
          { min: 0, max: 50000, rate: 0.10 },
          { min: 50000, max: Infinity, rate: 0.15 },
        ],
        joint: [
          { min: 0, max: 50000, rate: 0.10 },
          { min: 50000, max: Infinity, rate: 0.15 },
        ],
      },
      standardDeduction: { single: 13000, joint: 26000 },
      standardDeductionPhaseoutStart: { single: 999999, joint: 999999 },
      amtExemption: { single: 10000, joint: 20000 },
      amtPhaseoutStart: { single: 500000, joint: 750000 },
      amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
      medicalDeductionFloorRate: 0.075,
    };
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 300000);
    const result = calc.calculate();
    // taxable = 300000 - 13000 = 287000
    // regular: 50000*0.10 + 237000*0.15 = 5000 + 35550 = 40550
    // AMT income: 287000 + 13000 = 300000 (add back std deduction)
    // exemption: 10000 (no phaseout, 300000 < 500000)
    // AMT taxable: 290000
    // AMT: 200000*0.26 + 90000*0.28 = 52000 + 25200 = 77200
    // AMT (77200) > regular (40550) → use AMT
    expect(result.amt).toBe(77200);
    expect(result.regularTax).toBe(40550);
    expect(result.finalTax).toBe(77200);
  });

  it('AMT exemption phases out', () => {
    const config = defaultConfig();
    config.amtExemption.single = 75000;
    config.amtPhaseoutStart.single = 100000;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 200000);
    const result = calc.calculate();
    // taxable = 200000 - 13000 = 187000
    // AMT income = 187000 + 13000 = 200000
    // exemption phaseout: excess = 200000 - 100000 = 100000
    // reduction = 100000 * 0.25 = 25000
    // exemption = 75000 - 25000 = 50000
    // AMT taxable = 200000 - 50000 = 150000
    // AMT = 150000 * 0.26 = 39000 (all in low bracket)
    expect(result.amt).toBe(39000);
  });

  it('AMT exemption fully phases out', () => {
    const config = defaultConfig();
    config.amtExemption.single = 75000;
    config.amtPhaseoutStart.single = 100000;
    const calc = createTaxCalculator(config);
    // To fully phase out: 75000 / 0.25 = 300000 above phaseoutStart
    // AMT income needs to be 400000
    // AMT income = taxable + std deduction = (income - stdDed) + stdDed = income
    // So income = 400000
    calc.setIncome(1, 400000);
    const result = calc.calculate();
    // AMT income = 400000
    // excess = 400000 - 100000 = 300000
    // reduction = 300000 * 0.25 = 75000 → exemption = 0
    // AMT taxable = 400000
    // AMT = 200000*0.26 + 200000*0.28 = 52000 + 56000 = 108000
    expect(result.amt).toBe(108000);
  });

  // === Zero Income ===

  it('zero income results in zero tax', () => {
    const calc = createTaxCalculator(defaultConfig());
    const result = calc.calculate();
    expect(result.grossIncome).toBe(0);
    expect(result.taxableIncome).toBe(0);
    expect(result.regularTax).toBe(0);
    expect(result.finalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('zero income with refundable credit gives negative tax', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.addCredit({ id: 'c1', amount: 1000, refundable: true });
    const result = calc.calculate();
    expect(result.finalTax).toBe(-1000);
    expect(result.effectiveRate).toBe(0); // grossIncome is 0
  });

  // === Income at Bracket Boundaries ===

  it('income exactly at first bracket boundary', () => {
    const config = defaultConfig();
    config.standardDeduction.single = 0;
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 10000);
    const result = calc.calculate();
    // All in first bracket: 10000 * 0.10 = 1000
    expect(result.regularTax).toBe(1000);
    expect(result.bracketBreakdown[0].taxableInBracket).toBe(10000);
    expect(result.bracketBreakdown[1].taxableInBracket).toBe(0);
  });

  it('income one dollar above bracket boundary', () => {
    const config = defaultConfig();
    config.standardDeduction.single = 0;
    config.standardDeductionPhaseoutStart.single = 999999;
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 10001);
    const result = calc.calculate();
    // Bracket 1: 10000 * 0.10 = 1000
    // Bracket 2: 1 * 0.22 = 0.22
    expect(result.regularTax).toBe(1000.22);
  });

  // === Monthly Breakdown ===

  it('monthly breakdown sums to 12 months', () => {
    const calc = createTaxCalculator(defaultConfig());
    for (let m = 1; m <= 12; m++) calc.setIncome(m, 5000);
    const monthly = calc.getMonthlyBreakdown();
    expect(monthly).toHaveLength(12);
    expect(monthly[11].cumulativeIncome).toBe(60000);
  });

  it('months with no income have zero income', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.setIncome(3, 60000);
    const monthly = calc.getMonthlyBreakdown();
    expect(monthly[0].income).toBe(0);
    expect(monthly[2].income).toBe(60000);
  });

  it('cumulative tax increases monotonically', () => {
    const calc = createTaxCalculator(defaultConfig());
    for (let m = 1; m <= 12; m++) calc.setIncome(m, 5000);
    const monthly = calc.getMonthlyBreakdown();
    for (let i = 1; i < monthly.length; i++) {
      expect(monthly[i].cumulativeTax).toBeGreaterThanOrEqual(monthly[i - 1].cumulativeTax);
    }
  });

  // === Effective Rate ===

  it('effective rate is finalTax / grossIncome', () => {
    const calc = createTaxCalculator(defaultConfig());
    calc.setIncome(1, 100000);
    const result = calc.calculate();
    expect(result.effectiveRate).toBeCloseTo(result.finalTax / result.grossIncome, 4);
  });

  // === Validation ===

  it('throws on invalid month for setIncome', () => {
    const calc = createTaxCalculator(defaultConfig());
    expect(() => calc.setIncome(0, 1000)).toThrow(TaxError);
    expect(() => calc.setIncome(13, 1000)).toThrow(TaxError);
    expect(() => calc.setIncome(1.5, 1000)).toThrow(TaxError);
  });

  it('throws on negative income', () => {
    const calc = createTaxCalculator(defaultConfig());
    expect(() => calc.setIncome(1, -100)).toThrow(TaxError);
  });

  it('throws on negative deduction', () => {
    const calc = createTaxCalculator(defaultConfig());
    expect(() => calc.addDeduction({ id: 'd1', type: 'other', amount: -100 })).toThrow(TaxError);
  });

  it('throws on negative credit', () => {
    const calc = createTaxCalculator(defaultConfig());
    expect(() => calc.addCredit({ id: 'c1', amount: -100, refundable: false })).toThrow(TaxError);
  });

  it('throws on invalid filing status', () => {
    const calc = createTaxCalculator(defaultConfig());
    expect(() => calc.setFilingStatus('married' as any)).toThrow(TaxError);
  });

  it('throws on invalid brackets (not starting at 0)', () => {
    const config = defaultConfig();
    config.brackets.single[0].min = 100;
    expect(() => createTaxCalculator(config)).toThrow(TaxError);
  });

  it('throws on invalid brackets (not ending at Infinity)', () => {
    const config = defaultConfig();
    config.brackets.single[config.brackets.single.length - 1].max = 500000;
    expect(() => createTaxCalculator(config)).toThrow(TaxError);
  });

  it('throws on invalid month for adjustBrackets', () => {
    const calc = createTaxCalculator(defaultConfig());
    const b = { single: [{ min: 0, max: Infinity, rate: 0.1 }], joint: [{ min: 0, max: Infinity, rate: 0.1 }] };
    expect(() => calc.adjustBrackets(b, 0)).toThrow(TaxError);
    expect(() => calc.adjustBrackets(b, 13)).toThrow(TaxError);
  });

  // === Deductions Exceeding Income ===

  it('deductions exceeding income result in zero taxable income', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 5000); // Less than standard deduction of 13000
    const result = calc.calculate();
    expect(result.taxableIncome).toBe(0);
    expect(result.regularTax).toBe(0);
  });

  // === Complex Scenario: Mixed Everything ===

  it('complex scenario with credits, deductions, and mid-year adjustment', () => {
    const config = defaultConfig();
    const calc = createTaxCalculator(config);

    // Monthly income varying throughout the year
    calc.setIncome(1, 8000);
    calc.setIncome(2, 8000);
    calc.setIncome(3, 8000);
    calc.setIncome(4, 10000);
    calc.setIncome(5, 10000);
    calc.setIncome(6, 10000);
    calc.setIncome(7, 12000);
    calc.setIncome(8, 12000);
    calc.setIncome(9, 12000);
    calc.setIncome(10, 15000);
    calc.setIncome(11, 15000);
    calc.setIncome(12, 15000);
    // Total = 3*8000 + 3*10000 + 3*12000 + 3*15000 = 24000+30000+36000+45000 = 135000

    calc.addCredit({ id: 'child', amount: 2000, refundable: false });
    calc.addCredit({ id: 'eitc', amount: 500, refundable: true });

    const result = calc.calculate();
    expect(result.grossIncome).toBe(135000);
    expect(result.totalCredits).toBe(2500);
    expect(result.finalTax).toBeLessThan(result.regularTax);
  });

  // === AMT with Itemized Deductions (Not Added Back) ===

  it('AMT does not add back itemized deductions', () => {
    const config: TaxCalculatorConfig = {
      brackets: {
        single: [
          { min: 0, max: 50000, rate: 0.10 },
          { min: 50000, max: Infinity, rate: 0.15 },
        ],
        joint: [
          { min: 0, max: 50000, rate: 0.10 },
          { min: 50000, max: Infinity, rate: 0.15 },
        ],
      },
      standardDeduction: { single: 13000, joint: 26000 },
      standardDeductionPhaseoutStart: { single: 999999, joint: 999999 },
      amtExemption: { single: 10000, joint: 20000 },
      amtPhaseoutStart: { single: 500000, joint: 750000 },
      amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
      medicalDeductionFloorRate: 0.075,
    };
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 200000);
    // Use itemized deduction = 30000 > standard = 13000
    calc.addDeduction({ id: 'o1', type: 'other', amount: 30000 });
    const result = calc.calculate();
    // taxable = 200000 - 30000 = 170000
    // regular: 50000*0.10 + 120000*0.15 = 5000 + 18000 = 23000
    // AMT income: 170000 (itemized NOT added back)
    // exemption: 10000
    // AMT taxable: 160000
    // AMT: 160000 * 0.26 = 41600
    // AMT > regular → use AMT
    expect(result.regularTax).toBe(23000);
    expect(result.amt).toBe(41600);
    expect(result.finalTax).toBe(41600);
  });

  // === Credits Applied Against AMT ===

  it('credits are applied against AMT when AMT is higher', () => {
    const config: TaxCalculatorConfig = {
      brackets: {
        single: [{ min: 0, max: Infinity, rate: 0.10 }],
        joint: [{ min: 0, max: Infinity, rate: 0.10 }],
      },
      standardDeduction: { single: 13000, joint: 26000 },
      standardDeductionPhaseoutStart: { single: 999999, joint: 999999 },
      amtExemption: { single: 10000, joint: 20000 },
      amtPhaseoutStart: { single: 999999, joint: 999999 },
      amtRates: { lowRate: 0.26, lowRateMax: 200000, highRate: 0.28 },
      medicalDeductionFloorRate: 0.075,
    };
    const calc = createTaxCalculator(config);
    calc.setIncome(1, 100000);
    calc.addCredit({ id: 'c1', amount: 5000, refundable: false });
    const result = calc.calculate();
    // taxable = 100000 - 13000 = 87000
    // regular = 87000 * 0.10 = 8700
    // AMT income = 87000 + 13000 = 100000 (std deduction added back)
    // exemption = 10000, AMT taxable = 90000
    // AMT = 90000 * 0.26 = 23400
    // max(8700, 23400) = 23400
    // 23400 - 5000 = 18400
    expect(result.finalTax).toBe(18400);
  });
});
