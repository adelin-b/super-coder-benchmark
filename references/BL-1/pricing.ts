/**
 * BL-1: Mandate Pricing Engine — Reference Implementation
 * 
 * This is the GROUND TRUTH implementation.
 * All outputs are rounded to 2 decimal places.
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

/** Round to 2 decimal places using banker's rounding */
function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate pricing from net seller price and commission rate.
 * 
 * Formula: prixAffiche = prixNetVendeur / (1 - commissionRate)
 * 
 * @param prixNetVendeur - Net price for the vendor (must be > 0)
 * @param commissionRate - Commission as decimal [0, 1) e.g. 0.05 = 5%
 * @throws PricingError if inputs are invalid
 */
export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  if (!Number.isFinite(prixNetVendeur) || prixNetVendeur <= 0) {
    throw new PricingError(`prixNetVendeur must be positive, got ${prixNetVendeur}`);
  }
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    throw new PricingError(`commissionRate must be in [0, 1), got ${commissionRate}`);
  }

  const prixAffiche = roundCents(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundCents(prixNetVendeur);
  const commissionShare = roundCents(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

/**
 * Validate whether a target price falls within tolerance of the computed price.
 */
export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  if (!Number.isFinite(target) || !Number.isFinite(prixAffiche) || !Number.isFinite(tolerance)) {
    throw new PricingError('All arguments must be finite numbers');
  }
  if (tolerance < 0) {
    throw new PricingError(`tolerance must be non-negative, got ${tolerance}`);
  }
  return Math.abs(target - prixAffiche) <= tolerance;
}

export interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

/**
 * Calculate pricing for multiple mandates.
 * Totals are accumulated with per-item rounding to avoid floating point drift.
 */
export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): BatchPricingResult {
  if (!Array.isArray(mandates) || mandates.length === 0) {
    throw new PricingError('mandates must be a non-empty array');
  }

  const results: PricingResult[] = [];
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;

  for (const m of mandates) {
    const result = calculatePricing(m.prixNetVendeur, m.commissionRate);
    results.push(result);
    // Accumulate with rounding at each step to prevent drift
    totalPrixAffiche = roundCents(totalPrixAffiche + result.prixAffiche);
    totalVendorShare = roundCents(totalVendorShare + result.vendorShare);
    totalCommissionShare = roundCents(totalCommissionShare + result.commissionShare);
  }

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
