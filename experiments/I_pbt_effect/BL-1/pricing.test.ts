/**
 * Method I: PBT + Effect TS Hybrid — Tests
 * fast-check properties verify Effect pipeline success/failure channels.
 */
import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import fc from 'fast-check';
import {
  calculatePricing,
  calculatePricingEffect,
  validatePrixTarget,
  validatePrixTargetEffect,
  calculateBatchPricing,
  calculateBatchPricingEffect,
  PricingError,
} from './pricing.js';

const arbPrixNet = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
const arbCommRate = fc.double({ min: 0, max: 0.99, noNaN: true, noDefaultInfinity: true });

describe('BL-1: PBT + Effect TS Hybrid', () => {

  // ─── Effect Success Channel Properties ────────────────────────

  describe('PROPERTY: Effect success channel returns valid PricingResult', () => {
    it('all valid inputs produce Success with correct structure', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const exit = Effect.runSyncExit(calculatePricingEffect(prix, rate));
        if (exit._tag !== 'Success') return false;
        const r = exit.value;
        return r.prixAffiche > 0 && r.vendorShare > 0 && r.commissionShare >= 0;
      }), { numRuns: 1000 });
    });
  });

  describe('PROPERTY: Effect failure channel catches invalid inputs', () => {
    it('non-positive prixNetVendeur → Failure channel', () => {
      fc.assert(fc.property(
        fc.double({ min: -100000, max: 0, noNaN: true, noDefaultInfinity: true }),
        arbCommRate,
        (prix, rate) => {
          const exit = Effect.runSyncExit(calculatePricingEffect(prix, rate));
          return exit._tag === 'Failure';
        },
      ));
    });

    it('commissionRate >= 1 → Failure channel', () => {
      fc.assert(fc.property(
        arbPrixNet,
        fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
        (prix, rate) => {
          const exit = Effect.runSyncExit(calculatePricingEffect(prix, rate));
          return exit._tag === 'Failure';
        },
      ));
    });
  });

  // ─── Invariant Properties (via Effect.runSync) ────────────────

  describe('PROPERTY: INV1 — parts sum to whole', () => {
    it('vendorShare + commissionShare ≈ prixAffiche', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return Math.abs((r.vendorShare + r.commissionShare) - r.prixAffiche) < 0.015;
      }), { numRuns: 1000 });
    });
  });

  describe('PROPERTY: INV2 — price >= net', () => {
    it('prixAffiche >= vendorShare (rounded net)', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, (prix, rate) => {
        const r = calculatePricing(prix, rate);
        return r.prixAffiche >= r.vendorShare;
      }), { numRuns: 1000 });
    });
  });

  describe('PROPERTY: INV4 — monotonicity', () => {
    it('higher rate → higher price', () => {
      fc.assert(fc.property(arbPrixNet, arbCommRate, arbCommRate, (prix, r1, r2) => {
        const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
        return calculatePricing(prix, hi).prixAffiche >= calculatePricing(prix, lo).prixAffiche;
      }), { numRuns: 1000 });
    });
  });

  describe('PROPERTY: INV5 — zero commission identity', () => {
    it('rate=0 → prixAffiche = rounded prixNetVendeur', () => {
      fc.assert(fc.property(arbPrixNet, (prix) => {
        const r = calculatePricing(prix, 0);
        return r.prixAffiche === Math.round((prix + Number.EPSILON) * 100) / 100;
      }), { numRuns: 500 });
    });
  });

  // ─── Specific tests ───────────────────────────────────────────

  describe('calculatePricing specific cases', () => {
    it('10000 at 5%', () => {
      const r = calculatePricing(10000, 0.05);
      expect(r.prixAffiche).toBe(10526.32);
    });

    it('throws PricingError on invalid input', () => {
      expect(() => calculatePricing(-1, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(10000, 1)).toThrow(PricingError);
      expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
    });
  });

  describe('validatePrixTarget', () => {
    it('within tolerance', () => expect(validatePrixTarget(10526, 10526.32, 1)).toBe(true));
    it('outside tolerance', () => expect(validatePrixTarget(10000, 10526.32, 1)).toBe(false));
    it('throws on NaN', () => expect(() => validatePrixTarget(NaN, 100, 1)).toThrow(PricingError));
  });

  describe('calculateBatchPricing', () => {
    it('batch of 2', () => {
      const r = calculateBatchPricing([
        { prixNetVendeur: 10000, commissionRate: 0.05 },
        { prixNetVendeur: 20000, commissionRate: 0.10 },
      ]);
      expect(r.totalPrixAffiche).toBe(32748.54);
    });

    it('throws on empty', () => {
      expect(() => calculateBatchPricing([])).toThrow(PricingError);
    });
  });
});
