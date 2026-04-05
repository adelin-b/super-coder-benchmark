import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  validatePrixTarget,
  calculateBatchPricing,
  PricingError,
} from './pricing.js';

describe('BL-1: Mandate Pricing Engine', () => {
  describe('calculatePricing', () => {
    it('calculates basic pricing correctly', () => {
      // 10000 / (1 - 0.05) = 10526.32
      const result = calculatePricing(10000, 0.05);
      expect(result.prixAffiche).toBe(10526.32);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(526.32);
    });

    it('handles zero commission', () => {
      const result = calculatePricing(10000, 0);
      expect(result.prixAffiche).toBe(10000);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(0);
    });

    it('handles high commission (50%)', () => {
      // 10000 / (1 - 0.5) = 20000
      const result = calculatePricing(10000, 0.5);
      expect(result.prixAffiche).toBe(20000);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(10000);
    });

    it('handles very small commission', () => {
      const result = calculatePricing(10000, 0.001);
      expect(result.prixAffiche).toBe(10010.01);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(10.01);
    });

    // Invariant 1: parts sum to whole
    it('vendor + commission === prixAffiche', () => {
      const result = calculatePricing(15999.99, 0.07);
      expect(result.vendorShare + result.commissionShare).toBeCloseTo(result.prixAffiche, 2);
    });

    // Invariant 2: price increases with commission
    it('prixAffiche >= prixNetVendeur', () => {
      for (const rate of [0, 0.01, 0.1, 0.25, 0.5, 0.99]) {
        const result = calculatePricing(10000, rate);
        expect(result.prixAffiche).toBeGreaterThanOrEqual(10000);
      }
    });

    // Invariant 3: all outputs positive
    it('all outputs are positive for valid inputs', () => {
      const result = calculatePricing(1, 0.01);
      expect(result.prixAffiche).toBeGreaterThan(0);
      expect(result.vendorShare).toBeGreaterThan(0);
      expect(result.commissionShare).toBeGreaterThanOrEqual(0);
    });

    // Invariant 4: monotonicity
    it('higher commission → higher price', () => {
      const low = calculatePricing(10000, 0.05);
      const high = calculatePricing(10000, 0.10);
      expect(high.prixAffiche).toBeGreaterThan(low.prixAffiche);
    });

    // Error cases
    it('rejects zero price', () => {
      expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
    });

    it('rejects negative price', () => {
      expect(() => calculatePricing(-100, 0.05)).toThrow(PricingError);
    });

    it('rejects commission >= 1', () => {
      expect(() => calculatePricing(10000, 1)).toThrow(PricingError);
      expect(() => calculatePricing(10000, 1.5)).toThrow(PricingError);
    });

    it('rejects negative commission', () => {
      expect(() => calculatePricing(10000, -0.05)).toThrow(PricingError);
    });

    it('rejects NaN/Infinity', () => {
      expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(10000, NaN)).toThrow(PricingError);
      expect(() => calculatePricing(Infinity, 0.05)).toThrow(PricingError);
    });
  });

  describe('validatePrixTarget', () => {
    it('accepts target within tolerance', () => {
      expect(validatePrixTarget(10500, 10526.32, 50)).toBe(true);
    });

    it('rejects target outside tolerance', () => {
      expect(validatePrixTarget(10400, 10526.32, 50)).toBe(false);
    });

    it('accepts exact match', () => {
      expect(validatePrixTarget(10526.32, 10526.32, 0)).toBe(true);
    });

    it('rejects negative tolerance', () => {
      expect(() => validatePrixTarget(100, 100, -1)).toThrow(PricingError);
    });
  });

  describe('calculateBatchPricing', () => {
    it('calculates batch correctly', () => {
      const result = calculateBatchPricing([
        { prixNetVendeur: 10000, commissionRate: 0.05 },
        { prixNetVendeur: 20000, commissionRate: 0.10 },
      ]);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].prixAffiche).toBe(10526.32);
      expect(result.results[1].prixAffiche).toBe(22222.22);
      expect(result.totalPrixAffiche).toBe(32748.54);
      expect(result.totalVendorShare).toBe(30000);
      expect(result.totalCommissionShare).toBe(2748.54);
    });

    it('totals sum correctly (no floating point drift)', () => {
      // Create many small amounts that would accumulate FP error
      const mandates = Array.from({ length: 100 }, () => ({
        prixNetVendeur: 99.99,
        commissionRate: 0.07,
      }));
      const result = calculateBatchPricing(mandates);
      // Each: 99.99 / 0.93 = 107.52 (rounded)
      // Total should be exactly 100 * 107.52 = 10752.00
      const expectedTotal = result.results.reduce((s, r) => s + r.prixAffiche, 0);
      expect(result.totalPrixAffiche).toBeCloseTo(expectedTotal, 2);
      // Check invariant: total = vendor + commission
      expect(result.totalPrixAffiche).toBeCloseTo(
        result.totalVendorShare + result.totalCommissionShare,
        2,
      );
    });

    it('rejects empty array', () => {
      expect(() => calculateBatchPricing([])).toThrow(PricingError);
    });

    it('propagates individual validation errors', () => {
      expect(() =>
        calculateBatchPricing([
          { prixNetVendeur: 10000, commissionRate: 0.05 },
          { prixNetVendeur: -100, commissionRate: 0.05 },
        ])
      ).toThrow(PricingError);
    });
  });
});
