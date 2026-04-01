/**
 * Method B: Effect TS + XState — Tests for BL-1 Mandate Pricing Engine
 */
import { describe, it, expect } from 'vitest';
import { Effect, pipe } from 'effect';
import {
  calculatePricing,
  calculatePricingEffect,
  validatePrixTarget,
  validatePrixTargetEffect,
  calculateBatchPricing,
  calculateBatchPricingEffect,
  PricingError,
  pricingMachine,
} from './pricing.js';

describe('BL-1: Effect TS + XState Pricing Engine', () => {
  // ─── Effect Pipeline Tests ──────────────────────────────────────

  describe('calculatePricingEffect', () => {
    it('succeeds with valid inputs', () => {
      const result = Effect.runSync(calculatePricingEffect(10000, 0.05));
      expect(result.prixAffiche).toBe(10526.32);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(526.32);
    });

    it('fails with typed error on invalid prixNetVendeur', () => {
      const exit = Effect.runSyncExit(calculatePricingEffect(-100, 0.05));
      expect(exit._tag).toBe('Failure');
    });

    it('fails with typed error on invalid commissionRate', () => {
      const exit = Effect.runSyncExit(calculatePricingEffect(10000, 1.5));
      expect(exit._tag).toBe('Failure');
    });
  });

  // ─── Synchronous API Tests ────────────────────────────────────

  describe('calculatePricing', () => {
    it('calculates basic pricing correctly', () => {
      const result = calculatePricing(10000, 0.05);
      expect(result.prixAffiche).toBe(10526.32);
      expect(result.vendorShare).toBe(10000);
      expect(result.commissionShare).toBe(526.32);
    });

    it('handles zero commission', () => {
      const result = calculatePricing(5000, 0);
      expect(result.prixAffiche).toBe(5000);
      expect(result.vendorShare).toBe(5000);
      expect(result.commissionShare).toBe(0);
    });

    it('handles high commission', () => {
      const result = calculatePricing(1000, 0.99);
      expect(result.prixAffiche).toBe(100000);
      expect(result.vendorShare).toBe(1000);
      expect(result.commissionShare).toBe(99000);
    });

    it('throws PricingError for prixNetVendeur <= 0', () => {
      expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(-100, 0.05)).toThrow(PricingError);
    });

    it('throws PricingError for commissionRate >= 1', () => {
      expect(() => calculatePricing(10000, 1)).toThrow(PricingError);
      expect(() => calculatePricing(10000, 1.5)).toThrow(PricingError);
    });

    it('throws PricingError for commissionRate < 0', () => {
      expect(() => calculatePricing(10000, -0.1)).toThrow(PricingError);
    });

    it('throws PricingError for NaN inputs', () => {
      expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
      expect(() => calculatePricing(10000, NaN)).toThrow(PricingError);
    });
  });

  // ─── Invariant Tests ──────────────────────────────────────────

  describe('Invariants', () => {
    const testCases = [
      { prixNetVendeur: 10000, commissionRate: 0.05 },
      { prixNetVendeur: 50000, commissionRate: 0.10 },
      { prixNetVendeur: 1, commissionRate: 0.50 },
      { prixNetVendeur: 99999.99, commissionRate: 0.03 },
      { prixNetVendeur: 100, commissionRate: 0 },
      { prixNetVendeur: 0.01, commissionRate: 0.99 },
    ];

    it('INV1: vendorShare + commissionShare === prixAffiche', () => {
      for (const tc of testCases) {
        const r = calculatePricing(tc.prixNetVendeur, tc.commissionRate);
        expect(r.vendorShare + r.commissionShare).toBeCloseTo(r.prixAffiche, 2);
      }
    });

    it('INV2: prixAffiche >= prixNetVendeur', () => {
      for (const tc of testCases) {
        const r = calculatePricing(tc.prixNetVendeur, tc.commissionRate);
        expect(r.prixAffiche).toBeGreaterThanOrEqual(tc.prixNetVendeur);
      }
    });

    it('INV3: all outputs positive/non-negative', () => {
      for (const tc of testCases) {
        const r = calculatePricing(tc.prixNetVendeur, tc.commissionRate);
        expect(r.prixAffiche).toBeGreaterThan(0);
        expect(r.vendorShare).toBeGreaterThan(0);
        expect(r.commissionShare).toBeGreaterThanOrEqual(0);
      }
    });

    it('INV4: higher commission → higher prixAffiche (monotonicity)', () => {
      const base = 10000;
      const rates = [0, 0.01, 0.05, 0.10, 0.20, 0.50, 0.90];
      let prev = 0;
      for (const rate of rates) {
        const r = calculatePricing(base, rate);
        expect(r.prixAffiche).toBeGreaterThanOrEqual(prev);
        prev = r.prixAffiche;
      }
    });

    it('INV5: zero commission → prixAffiche === prixNetVendeur', () => {
      const r = calculatePricing(12345.67, 0);
      expect(r.prixAffiche).toBe(12345.67);
    });
  });

  // ─── validatePrixTarget ───────────────────────────────────────

  describe('validatePrixTarget', () => {
    it('returns true within tolerance', () => {
      expect(validatePrixTarget(10526, 10526.32, 1)).toBe(true);
    });

    it('returns false outside tolerance', () => {
      expect(validatePrixTarget(10000, 10526.32, 1)).toBe(false);
    });

    it('returns true on exact match', () => {
      expect(validatePrixTarget(10526.32, 10526.32, 0)).toBe(true);
    });

    it('throws on NaN inputs', () => {
      expect(() => validatePrixTarget(NaN, 100, 1)).toThrow(PricingError);
    });

    it('throws on negative tolerance', () => {
      expect(() => validatePrixTarget(100, 100, -1)).toThrow(PricingError);
    });
  });

  // ─── Batch Pricing ────────────────────────────────────────────

  describe('calculateBatchPricing', () => {
    it('computes batch correctly', () => {
      const result = calculateBatchPricing([
        { prixNetVendeur: 10000, commissionRate: 0.05 },
        { prixNetVendeur: 20000, commissionRate: 0.10 },
      ]);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].prixAffiche).toBe(10526.32);
      expect(result.results[1].prixAffiche).toBe(22222.22);
      expect(result.totalPrixAffiche).toBe(32748.54);
    });

    it('totals are properly rounded', () => {
      const mandates = Array.from({ length: 100 }, () => ({
        prixNetVendeur: 99.99,
        commissionRate: 0.07,
      }));
      const result = calculateBatchPricing(mandates);
      // Verify total is rounded to 2 decimals
      expect(result.totalPrixAffiche).toBe(
        Math.round(result.totalPrixAffiche * 100) / 100
      );
    });

    it('throws PricingError on invalid mandate', () => {
      expect(() =>
        calculateBatchPricing([
          { prixNetVendeur: 10000, commissionRate: 0.05 },
          { prixNetVendeur: -1, commissionRate: 0.05 },
        ])
      ).toThrow(PricingError);
    });
  });

  // ─── XState Machine Structure ─────────────────────────────────

  describe('pricingMachine', () => {
    it('has correct initial state', () => {
      expect(pricingMachine.config.initial).toBe('idle');
    });

    it('defines expected states', () => {
      const states = Object.keys(pricingMachine.config.states!);
      expect(states).toContain('idle');
      expect(states).toContain('validating');
      expect(states).toContain('computing');
      expect(states).toContain('success');
      expect(states).toContain('error');
    });
  });
});
