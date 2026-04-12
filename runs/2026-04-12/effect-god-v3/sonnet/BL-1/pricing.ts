import { Effect, Data, Exit, Cause } from "effect";

// ── Internal tagged errors ────────────────────────────────────────────────────

class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
  reason: string;
}> {}

// ── Public error class ────────────────────────────────────────────────────────

export class PricingError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PricingError";
    Object.setPrototypeOf(this, PricingError.prototype);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Internal Effect logic ─────────────────────────────────────────────────────

const calculatePricingEffect = (
  prixNetVendeur: number,
  commissionRate: number
): Effect.Effect<PricingResult, InvalidInputError> =>
  Effect.gen(function* () {
    if (prixNetVendeur <= 0) {
      yield* Effect.fail(
        new InvalidInputError({ reason: "prixNetVendeur must be > 0" })
      );
    }
    if (commissionRate < 0 || commissionRate >= 1) {
      yield* Effect.fail(
        new InvalidInputError({
          reason: "commissionRate must be in [0, 1)",
        })
      );
    }

    const prixAffiche = round2(prixNetVendeur / (1 - commissionRate));
    const vendorShare = round2(prixNetVendeur);
    // Derive commissionShare from prixAffiche - vendorShare to preserve invariant
    const commissionShare = round2(prixAffiche - vendorShare);

    return { prixAffiche, vendorShare, commissionShare };
  });

// ── Exported functions ────────────────────────────────────────────────────────

export function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  const exit = Effect.runSyncExit(
    calculatePricingEffect(prixNetVendeur, commissionRate)
  );
  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    const msg =
      raw instanceof Error
        ? raw.message
        : (raw as any).reason ?? String(raw);
    throw new PricingError(msg);
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
  const results: PricingResult[] = mandates.map(({ prixNetVendeur, commissionRate }) =>
    calculatePricing(prixNetVendeur, commissionRate)
  );

  // Sum per-item rounded values, then round totals to avoid float accumulation
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