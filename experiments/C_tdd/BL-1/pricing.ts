/**
 * Method C: TDD (Red/Green/Refactor) — BL-1 Mandate Pricing Engine
 * Built test-first, minimum code to pass each test.
 */

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// TDD Step 1: Make calculatePricing return correct result for basic input
// TDD Step 2: Add validation for prixNetVendeur
// TDD Step 3: Add validation for commissionRate
// TDD Step 4: Handle edge cases (NaN, Infinity)
// TDD Step 5: Add validatePrixTarget
// TDD Step 6: Add calculateBatchPricing
// TDD Step 7: Ensure batch totals are properly rounded

export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  // Validation (added in TDD steps 2-4)
  if (typeof prixNetVendeur !== 'number' || !isFinite(prixNetVendeur)) {
    throw new PricingError('prixNetVendeur must be a finite number');
  }
  if (typeof commissionRate !== 'number' || !isFinite(commissionRate)) {
    throw new PricingError('commissionRate must be a finite number');
  }
  if (prixNetVendeur <= 0) {
    throw new PricingError('prixNetVendeur must be > 0');
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new PricingError('commissionRate must be in [0, 1)');
  }

  // Core logic (TDD step 1)
  const prixAffiche = roundTo2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundTo2(prixNetVendeur);
  const commissionShare = roundTo2(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  if (typeof target !== 'number' || !isFinite(target)) {
    throw new PricingError('target must be a finite number');
  }
  if (typeof prixAffiche !== 'number' || !isFinite(prixAffiche)) {
    throw new PricingError('prixAffiche must be a finite number');
  }
  if (typeof tolerance !== 'number' || !isFinite(tolerance) || tolerance < 0) {
    throw new PricingError('tolerance must be a non-negative finite number');
  }
  return Math.abs(target - prixAffiche) <= tolerance;
}

export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
} {
  if (!Array.isArray(mandates)) {
    throw new PricingError('mandates must be an array');
  }
  if (mandates.length === 0) {
    throw new PricingError('mandates must not be empty');
  }

  const results: PricingResult[] = [];
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;

  for (let i = 0; i < mandates.length; i++) {
    try {
      const r = calculatePricing(mandates[i].prixNetVendeur, mandates[i].commissionRate);
      results.push(r);
      totalPrixAffiche = roundTo2(totalPrixAffiche + r.prixAffiche);
      totalVendorShare = roundTo2(totalVendorShare + r.vendorShare);
      totalCommissionShare = roundTo2(totalCommissionShare + r.commissionShare);
    } catch (e) {
      if (e instanceof PricingError) {
        throw new PricingError(`Mandate at index ${i}: ${e.message}`);
      }
      throw e;
    }
  }

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
