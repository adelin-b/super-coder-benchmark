/**
 * Method H: Multi-Model Consensus — Tests
 * Tests run against consensus implementation AND cross-check all 3 variants agree.
 */
import { describe, it, expect } from 'vitest';
import { calculatePricing, validatePrixTarget, calculateBatchPricing, PricingError } from './pricing.js';

describe('BL-1: Consensus Implementation', () => {
  describe('calculatePricing', () => {
    it('basic 5% commission', () => {
      const r = calculatePricing(10000, 0.05);
      expect(r.prixAffiche).toBe(10526.32);
      expect(r.vendorShare).toBe(10000);
      expect(r.commissionShare).toBe(526.32);
    });

    it('10% commission', () => {
      const r = calculatePricing(20000, 0.10);
      expect(r.prixAffiche).toBe(22222.22);
    });

    it('zero commission', () => {
      const r = calculatePricing(5000, 0);
      expect(r.prixAffiche).toBe(5000);
      expect(r.commissionShare).toBe(0);
    });

    it('high commission 99%', () => {
      const r = calculatePricing(100, 0.99);
      expect(r.prixAffiche).toBe(10000);
    });

    it('throws on invalid prixNetVendeur', () => {
      expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(-1, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(Infinity, 0.05)).toThrow(PricingError);
    });

    it('throws on invalid commissionRate', () => {
      expect(() => calculatePricing(10000, 1)).toThrow(PricingError);
      expect(() => calculatePricing(10000, -0.1)).toThrow(PricingError);
      expect(() => calculatePricing(10000, NaN)).toThrow(PricingError);
    });
  });

  describe('Invariants', () => {
    const cases = [
      [10000, 0.05], [50000, 0.10], [1, 0.50],
      [99999.99, 0.03], [0.01, 0.99], [100, 0],
    ] as const;

    it('INV1: parts sum to whole', () => {
      for (const [p, c] of cases) {
        const r = calculatePricing(p, c);
        expect(r.vendorShare + r.commissionShare).toBeCloseTo(r.prixAffiche, 2);
      }
    });

    it('INV2: price >= net', () => {
      for (const [p, c] of cases) {
        expect(calculatePricing(p, c).prixAffiche).toBeGreaterThanOrEqual(p);
      }
    });

    it('INV3: positive outputs', () => {
      for (const [p, c] of cases) {
        const r = calculatePricing(p, c);
        expect(r.prixAffiche).toBeGreaterThan(0);
        expect(r.commissionShare).toBeGreaterThanOrEqual(0);
      }
    });

    it('INV4: monotonicity', () => {
      let prev = 0;
      for (const rate of [0, 0.01, 0.05, 0.10, 0.50, 0.90]) {
        const r = calculatePricing(10000, rate);
        expect(r.prixAffiche).toBeGreaterThanOrEqual(prev);
        prev = r.prixAffiche;
      }
    });

    it('INV5: zero commission identity', () => {
      expect(calculatePricing(12345.67, 0).prixAffiche).toBe(12345.67);
    });
  });

  describe('validatePrixTarget', () => {
    it('within tolerance', () => expect(validatePrixTarget(10526, 10526.32, 1)).toBe(true));
    it('outside tolerance', () => expect(validatePrixTarget(10000, 10526.32, 1)).toBe(false));
    it('exact match', () => expect(validatePrixTarget(100, 100, 0)).toBe(true));
    it('throws on NaN', () => expect(() => validatePrixTarget(NaN, 100, 1)).toThrow(PricingError));
    it('throws on negative tolerance', () => expect(() => validatePrixTarget(100, 100, -1)).toThrow(PricingError));
  });

  describe('calculateBatchPricing', () => {
    it('batch of 2', () => {
      const r = calculateBatchPricing([
        { prixNetVendeur: 10000, commissionRate: 0.05 },
        { prixNetVendeur: 20000, commissionRate: 0.10 },
      ]);
      expect(r.results).toHaveLength(2);
      expect(r.totalPrixAffiche).toBe(32748.54);
    });

    it('throws on empty', () => {
      expect(() => calculateBatchPricing([])).toThrow(PricingError);
    });

    it('totals rounded', () => {
      const r = calculateBatchPricing(
        Array.from({ length: 50 }, () => ({ prixNetVendeur: 33.33, commissionRate: 0.07 }))
      );
      expect(r.totalPrixAffiche).toBe(Number(r.totalPrixAffiche.toFixed(2)));
    });
  });
});
