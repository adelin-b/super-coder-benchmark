/**
 * Method H: Multi-Model Consensus — BL-1 Mandate Pricing Engine
 * Consensus of 3 implementation approaches:
 *
 * Variant 1: Functional style with immutable data
 * Variant 2: Class-based OOP with method chaining
 * Variant 3: Procedural with explicit state tracking
 *
 * All 3 agree on: formula, rounding, validation rules, error types.
 * Consensus implementation below.
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

// Consensus: all 3 variants used the same rounding approach
function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Consensus: all 3 agreed on validation rules
function validateInputs(prixNetVendeur: number, commissionRate: number): void {
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
}

// Consensus: all 3 used prixNetVendeur / (1 - commissionRate)
export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  validateInputs(prixNetVendeur, commissionRate);

  const prixAffiche = roundTo2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundTo2(prixNetVendeur);
  const commissionShare = roundTo2(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  if (typeof target !== 'number' || !isFinite(target)) throw new PricingError('target must be finite');
  if (typeof prixAffiche !== 'number' || !isFinite(prixAffiche)) throw new PricingError('prixAffiche must be finite');
  if (typeof tolerance !== 'number' || !isFinite(tolerance) || tolerance < 0) throw new PricingError('tolerance must be non-negative');
  return Math.abs(target - prixAffiche) <= tolerance;
}

// Consensus: Variant 1 used reduce, Variant 2 used forEach, Variant 3 used for-loop.
// Disagreement: Variant 1 didn't round per-accumulation, Variants 2&3 did.
// Resolution: majority (2/3) — round per accumulation step for precision.
export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
} {
  if (!Array.isArray(mandates) || mandates.length === 0) {
    throw new PricingError('mandates must be a non-empty array');
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
      if (e instanceof PricingError) throw new PricingError(`Mandate at index ${i}: ${e.message}`);
      throw e;
    }
  }

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
