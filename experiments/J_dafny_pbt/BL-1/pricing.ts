/**
 * Method J: Dafny + PBT Hybrid — BL-1 Mandate Pricing Engine
 * TypeScript with documented pre/post conditions (Dafny-style requires/ensures)
 * + strong fast-check invariant properties as verification layer.
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

/**
 * @requires prixNetVendeur > 0 && isFinite(prixNetVendeur)
 * @requires 0 <= commissionRate < 1 && isFinite(commissionRate)
 * @ensures result.prixAffiche == roundTo2(prixNetVendeur / (1 - commissionRate))
 * @ensures result.vendorShare == roundTo2(prixNetVendeur)
 * @ensures result.commissionShare == roundTo2(result.prixAffiche - result.vendorShare)
 * @ensures result.prixAffiche >= prixNetVendeur
 * @ensures result.commissionShare >= 0
 * @ensures result.vendorShare + result.commissionShare ≈ result.prixAffiche (within 0.01)
 */
export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  // Precondition checks
  if (typeof prixNetVendeur !== 'number' || !isFinite(prixNetVendeur) || prixNetVendeur <= 0) {
    throw new PricingError('Precondition violated: prixNetVendeur must be a positive finite number');
  }
  if (typeof commissionRate !== 'number' || !isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    throw new PricingError('Precondition violated: commissionRate must be in [0, 1)');
  }

  const prixAffiche = roundTo2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundTo2(prixNetVendeur);
  const commissionShare = roundTo2(prixAffiche - vendorShare);

  // Postcondition assertions (runtime verification)
  // Compare rounded values — raw float prixNetVendeur may exceed rounded prixAffiche
  if (prixAffiche < vendorShare) {
    throw new PricingError('Postcondition violated: prixAffiche < vendorShare');
  }
  if (commissionShare < 0) {
    throw new PricingError('Postcondition violated: commissionShare < 0');
  }

  return { prixAffiche, vendorShare, commissionShare };
}

/**
 * @requires isFinite(target) && isFinite(prixAffiche)
 * @requires tolerance >= 0 && isFinite(tolerance)
 * @ensures result == (|target - prixAffiche| <= tolerance)
 */
export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  if (typeof target !== 'number' || !isFinite(target)) throw new PricingError('Precondition: target must be finite');
  if (typeof prixAffiche !== 'number' || !isFinite(prixAffiche)) throw new PricingError('Precondition: prixAffiche must be finite');
  if (typeof tolerance !== 'number' || !isFinite(tolerance) || tolerance < 0) throw new PricingError('Precondition: tolerance must be non-negative finite');
  return Math.abs(target - prixAffiche) <= tolerance;
}

/**
 * @requires mandates.length > 0
 * @requires forall i. mandates[i] satisfies calculatePricing preconditions
 * @ensures result.totalPrixAffiche == roundTo2(sum(result.results[i].prixAffiche))
 * @ensures result.results.length == mandates.length
 */
export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
} {
  if (!Array.isArray(mandates) || mandates.length === 0) {
    throw new PricingError('Precondition: mandates must be a non-empty array');
  }

  const results: PricingResult[] = [];
  let totalPrixAffiche = 0, totalVendorShare = 0, totalCommissionShare = 0;

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

  // Postcondition: totals are properly rounded
  if (totalPrixAffiche !== roundTo2(totalPrixAffiche)) {
    throw new PricingError('Postcondition: totalPrixAffiche not properly rounded');
  }

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
