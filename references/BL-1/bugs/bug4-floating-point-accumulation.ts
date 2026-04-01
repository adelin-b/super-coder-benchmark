/**
 * BUG 4: floating_point_accumulation
 * In batch mode, sums using naive addition without rounding at each step.
 * Over many items, floating point error accumulates.
 * Example: 100 items at 99.99/0.07 → each is 107.52, total should be 10752.00
 * but naive addition might produce 10751.999999999998 or similar
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
  // BUG: naive accumulation without per-step rounding
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;
  for (const m of mandates) {
    const result = calculatePricing(m.prixNetVendeur, m.commissionRate);
    results.push(result);
    // BUG: no roundCents() on running totals
    totalPrixAffiche += result.prixAffiche;
    totalVendorShare += result.vendorShare;
    totalCommissionShare += result.commissionShare;
  }
  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
