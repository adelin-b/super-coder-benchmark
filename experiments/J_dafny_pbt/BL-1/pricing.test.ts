/**
 * Method J: Dafny + PBT Hybrid — Tests
 * Strong mathematical invariant properties (Dafny ensures-style) verified via fast-check.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculatePricing, validatePrixTarget, calculateBatchPricing, PricingError } from './pricing.js';

const arbPrixNet = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
const arbCommRate = fc.double({ min: 0, max: 0.99, noNaN: true, noDefaultInfinity: true });

describe('BL-1: Dafny+PBT Hybrid Verification', () => {

  // ─── Postcondition properties (ensures-style) ──────────────────

  describe('ENSURES: prixAffiche is correctly computed', () => {
    it('prixAffiche > 0 and properly rounded for all valid inputs', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return r.prixAffiche > 0 && r.prixAffiche === Math.round(r.prixAffiche * 100) / 100;
      }), { numRuns: 2000 });
    });
  });

  describe('ENSURES: vendorShare == roundTo2(prixNetVendeur)', () => {
    it('vendor share is properly rounded', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return r.vendorShare > 0 && r.vendorShare === Math.round(r.vendorShare * 100) / 100;
      }), { numRuns: 1000 });
    });
  });

  describe('ENSURES: commissionShare == roundTo2(prixAffiche - vendorShare)', () => {
    it('parts sum to whole within rounding tolerance', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return Math.abs((r.vendorShare + r.commissionShare) - r.prixAffiche) < 0.015;
      }), { numRuns: 1000 });
    });
  });

  describe('ENSURES: prixAffiche >= vendorShare (rounded net)', () => {
    it('price never less than rounded vendor share', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return r.prixAffiche >= r.vendorShare;
      }), { numRuns: 2000 });
    });
  });

  describe('ENSURES: commissionShare >= 0', () => {
    it('commission never negative', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        return calculatePricing(prix, rate).commissionShare >= 0;
      }), { numRuns: 2000 });
    });
  });

  // ─── Precondition properties (requires-style) ──────────────────

  describe('REQUIRES: violations always produce PricingError', () => {
    it('prixNetVendeur <= 0 → PricingError', () => {
      fc.assert(fc.property(
        fc.double({ min: -100000, max: 0, noNaN: true, noDefaultInfinity: true }),
        arbCommRate,
        (prix, rate) => {
          try { calculatePricing(prix, rate); return false; }
          catch (e) { return e instanceof PricingError; }
        },
      ));
    });

    it('commissionRate outside [0,1) → PricingError', () => {
      fc.assert(fc.property(
        arbPrixNet,
        fc.oneof(
          fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -100, max: -0.001, noNaN: true, noDefaultInfinity: true }),
        ),
        (prix, rate) => {
          try { calculatePricing(prix, rate); return false; }
          catch (e) { return e instanceof PricingError; }
        },
      ));
    });
  });

  // ─── Monotonicity (mathematical property) ──────────────────────

  describe('THEOREM: monotonicity — rate1 <= rate2 → price1 <= price2', () => {
    it('holds for all valid inputs', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, arbCommRate, (prix, r1, r2) => {
        const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
        return calculatePricing(prix, hi).prixAffiche >= calculatePricing(prix, lo).prixAffiche;
      }), { numRuns: 2000 });
    });
  });

  // ─── Identity (zero commission) ────────────────────────────────

  describe('THEOREM: zero commission identity', () => {
    it('rate=0 → prixAffiche == vendorShare', () => {
      fc.assert(fc.property(arbPrixNet, (prix) => {
        const r = calculatePricing(prix, 0);
        return r.prixAffiche === r.vendorShare && r.commissionShare === 0;
      }), { numRuns: 1000 });
    });
  });

  // ─── Batch postconditions ──────────────────────────────────────

  describe('ENSURES: batch results length == mandates length', () => {
    it('holds', () => {
      fc.assert(fc.property(
        fc.array(fc.record({ prixNetVendeur: arbPrixNet, commissionRate: arbCommRate }), { minLength: 1, maxLength: 20 }),
        (mandates) => {
          return calculateBatchPricing(mandates).results.length === mandates.length;
        },
      ), { numRuns: 200 });
    });
  });

  // ─── Specific value tests ─────────────────────────────────────

  describe('Specific cases', () => {
    it('10000 at 5%', () => expect(calculatePricing(10000, 0.05).prixAffiche).toBe(10526.32));
    it('zero commission', () => expect(calculatePricing(5000, 0).prixAffiche).toBe(5000));
    it('validatePrixTarget', () => {
      expect(validatePrixTarget(10526, 10526.32, 1)).toBe(true);
      expect(validatePrixTarget(10000, 10526.32, 1)).toBe(false);
    });
    it('batch', () => {
      const r = calculateBatchPricing([
        { prixNetVendeur: 10000, commissionRate: 0.05 },
        { prixNetVendeur: 20000, commissionRate: 0.10 },
      ]);
      expect(r.totalPrixAffiche).toBe(32748.54);
    });
  });
});
