import { Effect, Data, Exit, Cause } from "effect";

// ── Internal tagged errors ────────────────────────────────────────────────────

class InvalidPrixNetVendeur extends Data.TaggedError("InvalidPrixNetVendeur")<{
  reason: string;
}> {}

class InvalidCommissionRate extends Data.TaggedError("InvalidCommissionRate")<{
  reason: string;
}> {}

// ── Internal Effect logic ─────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;

const calculatePricingEffect = (
  prixNetVendeur: number,
  commissionRate: number
): Effect.Effect<PricingResult, InvalidPrixNetVendeur | InvalidCommissionRate> =>
  Effect.gen(function* () {
    if (prixNetVendeur <= 0) {
      yield* Effect.fail(
        new InvalidPrixNetVendeur({ reason: "prixNetVendeur must be > 0" })
      );
    }
    if (commissionRate < 0 || commissionRate >= 1) {
      yield* Effect.fail(
        new InvalidCommissionRate({
          reason: "commissionRate must be in [0, 1)",
        })
      );
    }

    const prixAffiche = round2(prixNetVendeur / (1 - commissionRate));
    const vendorShare = round2(prixNetVendeur);
    // Derive commissionShare from rounded values to preserve cent-level invariant
    const commissionShare = round2(prixAffiche - vendorShare);

    return { prixAffiche, vendorShare, commissionShare };
  });

// ── Public interface ──────────────────────────────────────────────────────────

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  // Validate before entering Effect
  if (prixNetVendeur <= 0) {
    throw new Error("prixNetVendeur must be > 0");
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new Error("commissionRate must be in [0, 1)");
  }

  const exit = Effect.runSyncExit(
    calculatePricingEffect(prixNetVendeur, commissionRate)
  );

  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }

  return exit.value;
}

export function validatePrixTarget(
  target: number,
  prixAffiche: number,
  tolerance: number
): boolean {
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
  const results: PricingResult[] = mandates.map((m) =>
    calculatePricing(m.prixNetVendeur, m.commissionRate)
  );

  // Sum per-rounded-item values, then round the totals to avoid accumulation drift
  let rawTotalPrixAffiche = 0;
  let rawTotalVendorShare = 0;
  let rawTotalCommissionShare = 0;

  for (const r of results) {
    rawTotalPrixAffiche += r.prixAffiche;
    rawTotalVendorShare += r.vendorShare;
    rawTotalCommissionShare += r.commissionShare;
  }

  return {
    results,
    totalPrixAffiche: round2(rawTotalPrixAffiche),
    totalVendorShare: round2(rawTotalVendorShare),
    totalCommissionShare: round2(rawTotalCommissionShare),
  };
}