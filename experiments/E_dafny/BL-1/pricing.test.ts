import { describe, it, expect } from "vitest";
import {
  calculatePricing,
  validatePrixTarget,
  calculateBatchPricing,
  PricingError,
  PricingResult,
} from "./pricing";

describe("calculatePricing", () => {
  it("calculates correctly for 5% commission", () => {
    const result = calculatePricing(100, 0.05);
    // 100 / (1 - 0.05) = 105.26
    expect(result.prixAffiche).toBe(105.26);
    expect(result.vendorShare).toBe(100);
    expect(result.commissionShare).toBe(5.26);
  });

  it("calculates correctly for 10% commission", () => {
    const result = calculatePricing(200, 0.1);
    // 200 / 0.9 = 222.22
    expect(result.prixAffiche).toBe(222.22);
    expect(result.vendorShare).toBe(200);
    expect(result.commissionShare).toBe(22.22);
  });

  it("handles 0% commission", () => {
    const result = calculatePricing(150, 0);
    expect(result.prixAffiche).toBe(150);
    expect(result.vendorShare).toBe(150);
    expect(result.commissionShare).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    // 100 / (1 - 0.03) = 103.09278...
    const result = calculatePricing(100, 0.03);
    expect(result.prixAffiche).toBe(103.09);
    expect(result.commissionShare).toBe(3.09);
  });

  it("handles small values", () => {
    const result = calculatePricing(0.01, 0.05);
    expect(result.prixAffiche).toBeGreaterThanOrEqual(result.vendorShare);
  });

  it("handles large values", () => {
    const result = calculatePricing(1_000_000, 0.15);
    expect(result.prixAffiche).toBe(1176470.59);
    expect(result.vendorShare).toBe(1_000_000);
  });

  // Error cases
  it("throws for prixNetVendeur <= 0", () => {
    expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
    expect(() => calculatePricing(-10, 0.05)).toThrow(PricingError);
  });

  it("throws for commissionRate < 0", () => {
    expect(() => calculatePricing(100, -0.01)).toThrow(PricingError);
  });

  it("throws for commissionRate >= 1", () => {
    expect(() => calculatePricing(100, 1)).toThrow(PricingError);
    expect(() => calculatePricing(100, 1.5)).toThrow(PricingError);
  });

  it("throws for NaN inputs", () => {
    expect(() => calculatePricing(NaN, 0.05)).toThrow(PricingError);
    expect(() => calculatePricing(100, NaN)).toThrow(PricingError);
  });
});

describe("Pricing invariants", () => {
  const testCases = [
    { prixNetVendeur: 100, commissionRate: 0.05 },
    { prixNetVendeur: 250.5, commissionRate: 0.1 },
    { prixNetVendeur: 999.99, commissionRate: 0.2 },
    { prixNetVendeur: 50, commissionRate: 0 },
    { prixNetVendeur: 1, commissionRate: 0.5 },
    { prixNetVendeur: 100000, commissionRate: 0.99 },
  ];

  for (const { prixNetVendeur, commissionRate } of testCases) {
    describe(`net=${prixNetVendeur}, rate=${commissionRate}`, () => {
      let result: PricingResult;

      it("computes without error", () => {
        result = calculatePricing(prixNetVendeur, commissionRate);
      });

      it("invariant 1: vendorShare + commissionShare === prixAffiche", () => {
        result = calculatePricing(prixNetVendeur, commissionRate);
        const sum =
          Math.round((result.vendorShare + result.commissionShare) * 100) / 100;
        expect(sum).toBe(result.prixAffiche);
      });

      it("invariant 2: prixAffiche >= prixNetVendeur", () => {
        result = calculatePricing(prixNetVendeur, commissionRate);
        expect(result.prixAffiche).toBeGreaterThanOrEqual(prixNetVendeur);
      });

      it("invariant 3: all outputs non-negative", () => {
        result = calculatePricing(prixNetVendeur, commissionRate);
        expect(result.prixAffiche).toBeGreaterThanOrEqual(0);
        expect(result.vendorShare).toBeGreaterThanOrEqual(0);
        expect(result.commissionShare).toBeGreaterThanOrEqual(0);
      });
    });
  }

  it("invariant 4: higher commission rate → higher prixAffiche", () => {
    const low = calculatePricing(100, 0.05);
    const high = calculatePricing(100, 0.15);
    expect(high.prixAffiche).toBeGreaterThan(low.prixAffiche);
  });

  it("invariant 5: commissionRate === 0 → prixAffiche === prixNetVendeur", () => {
    const result = calculatePricing(250, 0);
    expect(result.prixAffiche).toBe(250);
    expect(result.commissionShare).toBe(0);
  });

  it("invariant 6: invalid inputs throw errors", () => {
    expect(() => calculatePricing(-1, 0.05)).toThrow(PricingError);
    expect(() => calculatePricing(0, 0.05)).toThrow(PricingError);
    expect(() => calculatePricing(100, -0.1)).toThrow(PricingError);
    expect(() => calculatePricing(100, 1)).toThrow(PricingError);
  });
});

describe("validatePrixTarget", () => {
  it("returns true when target equals prixAffiche", () => {
    expect(validatePrixTarget(105.26, 105.26, 0)).toBe(true);
  });

  it("returns true when target is within tolerance", () => {
    expect(validatePrixTarget(106, 105.26, 1)).toBe(true);
    expect(validatePrixTarget(104.26, 105.26, 1)).toBe(true);
  });

  it("returns false when target is outside tolerance", () => {
    expect(validatePrixTarget(110, 105.26, 1)).toBe(false);
    expect(validatePrixTarget(100, 105.26, 1)).toBe(false);
  });

  it("returns true at exact boundary", () => {
    expect(validatePrixTarget(106.26, 105.26, 1)).toBe(true);
    expect(validatePrixTarget(104.26, 105.26, 1)).toBe(true);
  });

  it("throws for negative tolerance", () => {
    expect(() => validatePrixTarget(100, 100, -1)).toThrow(PricingError);
  });

  it("throws for NaN inputs", () => {
    expect(() => validatePrixTarget(NaN, 100, 1)).toThrow(PricingError);
    expect(() => validatePrixTarget(100, NaN, 1)).toThrow(PricingError);
    expect(() => validatePrixTarget(100, 100, NaN)).toThrow(PricingError);
  });
});

describe("calculateBatchPricing", () => {
  it("computes batch results correctly", () => {
    const mandates = [
      { prixNetVendeur: 100, commissionRate: 0.05 },
      { prixNetVendeur: 200, commissionRate: 0.1 },
    ];
    const batch = calculateBatchPricing(mandates);

    expect(batch.results).toHaveLength(2);
    expect(batch.results[0].prixAffiche).toBe(105.26);
    expect(batch.results[1].prixAffiche).toBe(222.22);

    expect(batch.totalPrixAffiche).toBe(327.48);
    expect(batch.totalVendorShare).toBe(300);
    expect(batch.totalCommissionShare).toBe(27.48);
  });

  it("handles empty array", () => {
    const batch = calculateBatchPricing([]);
    expect(batch.results).toHaveLength(0);
    expect(batch.totalPrixAffiche).toBe(0);
    expect(batch.totalVendorShare).toBe(0);
    expect(batch.totalCommissionShare).toBe(0);
  });

  it("handles single mandate", () => {
    const batch = calculateBatchPricing([
      { prixNetVendeur: 100, commissionRate: 0.05 },
    ]);
    expect(batch.results).toHaveLength(1);
    expect(batch.totalPrixAffiche).toBe(105.26);
  });

  it("throws with index info for invalid mandate", () => {
    const mandates = [
      { prixNetVendeur: 100, commissionRate: 0.05 },
      { prixNetVendeur: -50, commissionRate: 0.1 },
    ];
    expect(() => calculateBatchPricing(mandates)).toThrow(/index 1/);
  });

  it("totals sum correctly for batch", () => {
    const mandates = [
      { prixNetVendeur: 100, commissionRate: 0.05 },
      { prixNetVendeur: 200, commissionRate: 0.1 },
      { prixNetVendeur: 300, commissionRate: 0.15 },
    ];
    const batch = calculateBatchPricing(mandates);

    const sumPrix = batch.results.reduce((s, r) => s + r.prixAffiche, 0);
    const sumVendor = batch.results.reduce((s, r) => s + r.vendorShare, 0);
    const sumComm = batch.results.reduce((s, r) => s + r.commissionShare, 0);

    expect(batch.totalPrixAffiche).toBe(Math.round(sumPrix * 100) / 100);
    expect(batch.totalVendorShare).toBe(Math.round(sumVendor * 100) / 100);
    expect(batch.totalCommissionShare).toBe(Math.round(sumComm * 100) / 100);
  });
});
