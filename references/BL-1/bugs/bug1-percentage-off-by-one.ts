/**
 * BUG 1: percentage_off_by_one
 * Uses prixNetVendeur * (1 + commissionRate) instead of prixNetVendeur / (1 - commissionRate)
 * This gives a LOWER displayed price than correct formula.
 * Example: 10000 * 1.05 = 10500 vs correct 10000 / 0.95 = 10526.32
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
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    throw new Error(`commissionRate must be in [0, 1), got ${commissionRate}`);
  }

  // BUG: wrong formula — multiplication instead of division
  const prixAffiche = roundCents(prixNetVendeur * (1 + commissionRate));
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
