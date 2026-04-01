/**
 * Method C: TDD — Tests written FIRST, then implementation.
 * Each describe block represents one TDD cycle (Red → Green → Refactor).
 */
import { describe, it, expect } from 'vitest';
import { calculatePricing, validatePrixTarget, calculateBatchPricing, PricingError } from './pricing.js';

// ─── TDD Cycle 1: Basic calculation ────────────────────────────

describe('Cycle 1: calculatePricing returns correct result', () => {
  it('RED→GREEN: 10000 at 5% commission = 10526.32', () => {
    const r = calculatePricing(10000, 0.05);
    expect(r.prixAffiche).toBe(10526.32);
    expect(r.vendorShare).toBe(10000);
    expect(r.commissionShare).toBe(526.32);
  });

  it('RED→GREEN: 20000 at 10% commission = 22222.22', () => {
    const r = calculatePricing(20000, 0.10);
    expect(r.prixAffiche).toBe(22222.22);
    expect(r.vendorShare).toBe(20000);
    expect(r.commissionShare).toBe(2222.22);
  });

  it('RED→GREEN: small value 1 at 50% = 2', () => {
    const r = calculatePricing(1, 0.50);
    expect(r.prixAffiche).toBe(2);
    expect(r.vendorShare).toBe(1);
    expect(r.commissionShare).toBe(1);
  });
});

// ─── TDD Cycle 2: Input validation — prixNetVendeur ────────────

describe('Cycle 2: Reject invalid prixNetVendeur', () => {
  it('RED→GREEN: throws on zero', () => {
    expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on negative', () => {
    expect(() => calculatePricing(-100, 0.05)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on NaN', () => {
    expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on Infinity', () => {
    expect(() => calculatePricing(Infinity, 0.05)).toThrow(PricingError);
  });
});

// ─── TDD Cycle 3: Input validation — commissionRate ────────────

describe('Cycle 3: Reject invalid commissionRate', () => {
  it('RED→GREEN: throws on rate = 1', () => {
    expect(() => calculatePricing(10000, 1)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on rate > 1', () => {
    expect(() => calculatePricing(10000, 1.5)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on negative rate', () => {
    expect(() => calculatePricing(10000, -0.1)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on NaN rate', () => {
    expect(() => calculatePricing(10000, NaN)).toThrow(PricingError);
  });
});

// ─── TDD Cycle 4: Zero commission edge case ────────────────────

describe('Cycle 4: Zero commission', () => {
  it('RED→GREEN: 0% commission → prixAffiche === prixNetVendeur', () => {
    const r = calculatePricing(5000, 0);
    expect(r.prixAffiche).toBe(5000);
    expect(r.commissionShare).toBe(0);
  });
});

// ─── TDD Cycle 5: Invariants ───────────────────────────────────

describe('Cycle 5: Business invariants hold', () => {
  const cases = [
    [10000, 0.05], [50000, 0.10], [1, 0.50],
    [99999.99, 0.03], [0.01, 0.99], [100, 0],
  ] as const;

  it('INV1: vendorShare + commissionShare = prixAffiche', () => {
    for (const [p, c] of cases) {
      const r = calculatePricing(p, c);
      expect(r.vendorShare + r.commissionShare).toBeCloseTo(r.prixAffiche, 2);
    }
  });

  it('INV2: prixAffiche >= prixNetVendeur', () => {
    for (const [p, c] of cases) {
      const r = calculatePricing(p, c);
      expect(r.prixAffiche).toBeGreaterThanOrEqual(p);
    }
  });

  it('INV3: outputs positive/non-negative', () => {
    for (const [p, c] of cases) {
      const r = calculatePricing(p, c);
      expect(r.prixAffiche).toBeGreaterThan(0);
      expect(r.vendorShare).toBeGreaterThan(0);
      expect(r.commissionShare).toBeGreaterThanOrEqual(0);
    }
  });

  it('INV4: monotonicity — higher rate → higher price', () => {
    const rates = [0, 0.01, 0.05, 0.10, 0.50, 0.90];
    let prev = 0;
    for (const rate of rates) {
      const r = calculatePricing(10000, rate);
      expect(r.prixAffiche).toBeGreaterThanOrEqual(prev);
      prev = r.prixAffiche;
    }
  });

  it('INV5: zero commission identity', () => {
    expect(calculatePricing(7777.77, 0).prixAffiche).toBe(7777.77);
  });
});

// ─── TDD Cycle 6: validatePrixTarget ───────────────────────────

describe('Cycle 6: validatePrixTarget', () => {
  it('RED→GREEN: within tolerance returns true', () => {
    expect(validatePrixTarget(10526, 10526.32, 1)).toBe(true);
  });

  it('RED→GREEN: outside tolerance returns false', () => {
    expect(validatePrixTarget(10000, 10526.32, 1)).toBe(false);
  });

  it('RED→GREEN: exact match with zero tolerance', () => {
    expect(validatePrixTarget(100, 100, 0)).toBe(true);
  });

  it('RED→GREEN: throws on NaN', () => {
    expect(() => validatePrixTarget(NaN, 100, 1)).toThrow(PricingError);
  });

  it('RED→GREEN: throws on negative tolerance', () => {
    expect(() => validatePrixTarget(100, 100, -1)).toThrow(PricingError);
  });
});

// ─── TDD Cycle 7: Batch pricing ───────────────────────────────

describe('Cycle 7: calculateBatchPricing', () => {
  it('RED→GREEN: computes batch of 2', () => {
    const r = calculateBatchPricing([
      { prixNetVendeur: 10000, commissionRate: 0.05 },
      { prixNetVendeur: 20000, commissionRate: 0.10 },
    ]);
    expect(r.results).toHaveLength(2);
    expect(r.totalPrixAffiche).toBe(32748.54);
  });

  it('RED→GREEN: single mandate', () => {
    const r = calculateBatchPricing([
      { prixNetVendeur: 10000, commissionRate: 0.05 },
    ]);
    expect(r.results).toHaveLength(1);
    expect(r.totalPrixAffiche).toBe(10526.32);
  });

  it('RED→GREEN: throws on empty array', () => {
    expect(() => calculateBatchPricing([])).toThrow(PricingError);
  });

  it('RED→GREEN: throws on invalid mandate in batch', () => {
    expect(() => calculateBatchPricing([
      { prixNetVendeur: 10000, commissionRate: 0.05 },
      { prixNetVendeur: -1, commissionRate: 0.05 },
    ])).toThrow(PricingError);
  });

  it('RED→GREEN: batch totals are rounded to 2 decimals', () => {
    const mandates = Array.from({ length: 100 }, () => ({
      prixNetVendeur: 33.33, commissionRate: 0.07,
    }));
    const r = calculateBatchPricing(mandates);
    expect(Number(r.totalPrixAffiche.toFixed(2))).toBe(r.totalPrixAffiche);
  });
});
