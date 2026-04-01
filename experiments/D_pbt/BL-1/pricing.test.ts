/**
 * Method D: Property-Based Testing — BL-1 Mandate Pricing Engine
 * All tests use fast-check arbitraries and property assertions.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculatePricing, validatePrixTarget, calculateBatchPricing, PricingError } from './pricing.js';

// ─── Custom Arbitraries ─────────────────────────────────────────

/** Valid prixNetVendeur: positive finite number */
const arbPrixNet = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

/** Valid commissionRate: [0, 1) */
const arbCommRate = fc.double({ min: 0, max: 0.99, noNaN: true, noDefaultInfinity: true });

/** Invalid prixNetVendeur: non-positive or non-finite */
const arbInvalidPrix = fc.oneof(
  fc.constant(0),
  fc.constant(-1),
  fc.constant(-100),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
);

/** Invalid commissionRate: outside [0, 1) or non-finite */
const arbInvalidRate = fc.oneof(
  fc.constant(1),
  fc.constant(1.5),
  fc.constant(-0.1),
  fc.constant(NaN),
  fc.constant(Infinity),
);

// ─── Property Tests ─────────────────────────────────────────────

describe('BL-1: Property-Based Testing', () => {

  describe('PROPERTY: Parts sum to whole (INV1)', () => {
    it('vendorShare + commissionShare ≈ prixAffiche for all valid inputs', () => {
      fc.assert(
        fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
          const r = calculatePricing(prix, rate);
          const diff = Math.abs((r.vendorShare + r.commissionShare) - r.prixAffiche);
          return diff < 0.015; // within rounding tolerance
        }),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: Price always increases with commission (INV2)', () => {
    it('prixAffiche >= rounded prixNetVendeur for all valid inputs', () => {
      fc.assert(
        fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
          const r = calculatePricing(prix, rate);
          // Compare against rounded input (rounding can reduce below raw float)
          return r.prixAffiche >= r.vendorShare;
        }),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: All outputs positive/non-negative (INV3)', () => {
    it('prixAffiche > 0, vendorShare > 0, commissionShare >= 0', () => {
      fc.assert(
        fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
          const r = calculatePricing(prix, rate);
          return r.prixAffiche > 0 && r.vendorShare > 0 && r.commissionShare >= 0;
        }),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: Monotonicity (INV4)', () => {
    it('higher commission → higher or equal prixAffiche', () => {
      fc.assert(
        fc.property(
          arbPrixNet,
          arbCommRate,
          arbCommRate,
          (prix, rate1, rate2) => {
            const lo = Math.min(rate1, rate2);
            const hi = Math.max(rate1, rate2);
            const rLo = calculatePricing(prix, lo);
            const rHi = calculatePricing(prix, hi);
            return rHi.prixAffiche >= rLo.prixAffiche;
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: Zero commission identity (INV5)', () => {
    it('rate = 0 → prixAffiche === prixNetVendeur', () => {
      fc.assert(
        fc.property(arbPrixNet, (prix) => {
          const r = calculatePricing(prix, 0);
          return r.prixAffiche === Math.round((prix + Number.EPSILON) * 100) / 100;
        }),
        { numRuns: 500 },
      );
    });
  });

  describe('PROPERTY: Invalid inputs always throw PricingError', () => {
    it('invalid prixNetVendeur always throws', () => {
      fc.assert(
        fc.property(arbInvalidPrix, arbCommRate, (prix, rate) => {
          try {
            calculatePricing(prix, rate);
            return false; // should have thrown
          } catch (e) {
            return e instanceof PricingError;
          }
        }),
      );
    });

    it('invalid commissionRate always throws', () => {
      fc.assert(
        fc.property(arbPrixNet, arbInvalidRate, (prix, rate) => {
          try {
            calculatePricing(prix, rate);
            return false;
          } catch (e) {
            return e instanceof PricingError;
          }
        }),
      );
    });
  });

  describe('PROPERTY: Rounding — all outputs have ≤ 2 decimal places', () => {
    it('all monetary values are rounded to cents', () => {
      fc.assert(
        fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
          const r = calculatePricing(prix, rate);
          const hasTwoDecimals = (n: number) => Math.abs(n - Math.round(n * 100) / 100) < 1e-10;
          return hasTwoDecimals(r.prixAffiche) && hasTwoDecimals(r.vendorShare) && hasTwoDecimals(r.commissionShare);
        }),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: validatePrixTarget symmetry', () => {
    it('|target - prix| <= tolerance ↔ returns true', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
          (target, prix, tol) => {
            const result = validatePrixTarget(target, prix, tol);
            const expected = Math.abs(target - prix) <= tol;
            return result === expected;
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  describe('PROPERTY: Batch totals equal sum of individuals', () => {
    it('batch totals match sum of individual results', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ prixNetVendeur: arbPrixNet, commissionRate: arbCommRate }),
            { minLength: 1, maxLength: 20 },
          ),
          (mandates) => {
            const batch = calculateBatchPricing(mandates);
            const individualSum = batch.results.reduce((s, r) => s + r.prixAffiche, 0);
            // Batch total should be close to sum (rounding per-item may differ slightly)
            return Math.abs(batch.totalPrixAffiche - Math.round(individualSum * 100) / 100) < 0.02;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('PROPERTY: Batch with single element equals individual', () => {
    it('batch([x]) === calculatePricing(x)', () => {
      fc.assert(
        fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
          const single = calculatePricing(prix, rate);
          const batch = calculateBatchPricing([{ prixNetVendeur: prix, commissionRate: rate }]);
          return (
            batch.results[0].prixAffiche === single.prixAffiche &&
            batch.totalPrixAffiche === single.prixAffiche
          );
        }),
        { numRuns: 500 },
      );
    });
  });
});
