/**
 * BUG 2: division_by_zero
 * Missing guard for commissionRate === 1.0 — allows 100% commission
 * which causes division by zero (prixNetVendeur / 0 = Infinity)
 */
import type { PricingResult, BatchPricingResult } from '../pricing.js';
export { PricingError } from '../pricing.js';

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  if (!Number.isFinite(prixNetVendeur) || prixNetVendeur <= 0) {
    throw new Error(`prixNetVendeur must be positive, got ${prixNetVendeur}`);
  }
  // BUG: allows commissionRate === 1.0 (should be < 1, not <= 1)
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Error(`commissionRate must be in [0, 1], got ${commissionRate}`);
  }

  const prixAffiche = roundCents(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundCents(prixNetVendeur);
  const commissionShare = roundCents(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  if (!Number.isFinite(target) || !Number.isFinite(prixAffiche) || !Number.isFinite(tolerance)) {
    throw new Error('All arguments must be finite numbers');
  }
  if (tolerance < 0) throw new Error(`tolerance must be non-negative, got ${tolerance}`);
  return Math.abs(target - prixAffiche) <= tolerance;
}

export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): BatchPricingResult {
  if (!Array.isArray(mandates) || mandates.length === 0) {
    throw new Error('mandates must be a non-empty array');
  }
  const results: PricingResult[] = [];
  let totalPrixAffiche = 0, totalVendorShare = 0, totalCommissionShare = 0;
  for (const m of mandates) {
    const result = calculatePricing(m.prixNetVendeur, m.commissionRate);
    results.push(result);
    totalPrixAffiche = roundCents(totalPrixAffiche + result.prixAffiche);
    totalVendorShare = roundCents(totalVendorShare + result.vendorShare);
    totalCommissionShare = roundCents(totalCommissionShare + result.commissionShare);
  }
  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
