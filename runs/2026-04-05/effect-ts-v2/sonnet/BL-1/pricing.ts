import { Data, Effect } from "effect";

// ─── Errors ──────────────────────────────────────────────────────────────────

export class InvalidPrixNetVendeur extends Data.TaggedError(
  "InvalidPrixNetVendeur"
)<{ value: number; reason: string }> {}

export class InvalidCommissionRate extends Data.TaggedError(
  "InvalidCommissionRate"
)<{ value: number; reason: string }> {}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export interface MandateInput {
  prixNetVendeur: number;
  commissionRate: number;
}

export interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Core Effect ──────────────────────────────────────────────────────────────

export const calculatePricingEffect = (
  prixNetVendeur: number,
  commissionRate: number
): Effect.Effect<
  PricingResult,
  InvalidPrixNetVendeur | InvalidCommissionRate
> =>
  Effect.gen(function* () {
    if (prixNetVendeur <= 0) {
      yield* Effect.fail(
        new InvalidPrixNetVendeur({
          value: prixNetVendeur,
          reason: "prixNetVendeur must be > 0",
        })
      );
    }

    if (commissionRate < 0) {
      yield* Effect.fail(
        new InvalidCommissionRate({
          value: commissionRate,
          reason: "commissionRate must be >= 0",
        })
      );
    }

    if (commissionRate >= 1) {
      yield* Effect.fail(
        new InvalidCommissionRate({
          value: commissionRate,
          reason: "commissionRate must be < 1 (strictly less than 100%)",
        })
      );
    }

    const prixAffiche = round2(prixNetVendeur / (1 - commissionRate));
    const vendorShare = round2(prixNetVendeur);
    // Derive commissionShare from the rounded values to preserve invariant:
    // vendorShare + commissionShare === prixAffiche (to the cent)
    const commissionShare = round2(prixAffiche - vendorShare);

    return { prixAffiche, vendorShare, commissionShare };
  });

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate pricing synchronously.
 * Throws InvalidPrixNetVendeur or InvalidCommissionRate for invalid inputs.
 */
export function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  return Effect.runSync(calculatePricingEffect(prixNetVendeur, commissionRate));
}

/**
 * Check if a target price falls within ±tolerance of the computed prixAffiche.
 */
export function validatePrixTarget(
  target: number,
  prixAffiche: number,
  tolerance: number
): boolean {
  return Math.abs(target - prixAffiche) <= tolerance;
}

/**
 * Compute pricing for an array of mandates and sum totals.
 * Each item is rounded individually before accumulation to avoid
 * floating-point accumulation errors.
 */
export function calculateBatchPricing(mandates: MandateInput[]): BatchPricingResult {
  const results: PricingResult[] = mandates.map(({ prixNetVendeur, commissionRate }) =>
    calculatePricing(prixNetVendeur, commissionRate)
  );

  // Sum using per-item rounded values and re-round to guard against
  // residual floating-point drift across large batches.
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;

  for (const r of results) {
    totalPrixAffiche = round2(totalPrixAffiche + r.prixAffiche);
    totalVendorShare = round2(totalVendorShare + r.vendorShare);
    totalCommissionShare = round2(totalCommissionShare + r.commissionShare);
  }

  return {
    results,
    totalPrixAffiche,
    totalVendorShare,
    totalCommissionShare,
  };
}