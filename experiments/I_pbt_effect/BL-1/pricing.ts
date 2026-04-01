/**
 * Method I: PBT + Effect TS Hybrid — BL-1 Mandate Pricing Engine
 * Effect TS for typed error channels + fast-check for property verification.
 */
import { Effect, pipe } from 'effect';

// ─── Types ──────────────────────────────────────────────────────

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export class PricingError extends Error {
  readonly _tag = 'PricingError';
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Effect Pipelines ───────────────────────────────────────────

export function calculatePricingEffect(
  prixNetVendeur: number,
  commissionRate: number,
): Effect.Effect<PricingResult, PricingError> {
  return Effect.gen(function* () {
    if (typeof prixNetVendeur !== 'number' || !isFinite(prixNetVendeur) || prixNetVendeur <= 0) {
      return yield* Effect.fail(new PricingError('prixNetVendeur must be a positive finite number'));
    }
    if (typeof commissionRate !== 'number' || !isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
      return yield* Effect.fail(new PricingError('commissionRate must be in [0, 1)'));
    }

    const prixAffiche = roundTo2(prixNetVendeur / (1 - commissionRate));
    const vendorShare = roundTo2(prixNetVendeur);
    const commissionShare = roundTo2(prixAffiche - vendorShare);
    return { prixAffiche, vendorShare, commissionShare };
  });
}

export function validatePrixTargetEffect(
  target: number,
  prixAffiche: number,
  tolerance: number,
): Effect.Effect<boolean, PricingError> {
  return Effect.gen(function* () {
    if (typeof target !== 'number' || !isFinite(target)) return yield* Effect.fail(new PricingError('target must be finite'));
    if (typeof prixAffiche !== 'number' || !isFinite(prixAffiche)) return yield* Effect.fail(new PricingError('prixAffiche must be finite'));
    if (typeof tolerance !== 'number' || !isFinite(tolerance) || tolerance < 0) return yield* Effect.fail(new PricingError('tolerance must be non-negative'));
    return Math.abs(target - prixAffiche) <= tolerance;
  });
}

export function calculateBatchPricingEffect(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>,
): Effect.Effect<{ results: PricingResult[]; totalPrixAffiche: number; totalVendorShare: number; totalCommissionShare: number }, PricingError> {
  return Effect.gen(function* () {
    if (!Array.isArray(mandates) || mandates.length === 0) {
      return yield* Effect.fail(new PricingError('mandates must be a non-empty array'));
    }
    const results: PricingResult[] = [];
    let totalPrixAffiche = 0, totalVendorShare = 0, totalCommissionShare = 0;

    for (let i = 0; i < mandates.length; i++) {
      const r = yield* pipe(
        calculatePricingEffect(mandates[i].prixNetVendeur, mandates[i].commissionRate),
        Effect.mapError((e) => new PricingError(`Mandate at index ${i}: ${e.message}`)),
      );
      results.push(r);
      totalPrixAffiche = roundTo2(totalPrixAffiche + r.prixAffiche);
      totalVendorShare = roundTo2(totalVendorShare + r.vendorShare);
      totalCommissionShare = roundTo2(totalCommissionShare + r.commissionShare);
    }
    return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
  });
}

// ─── Synchronous throw-on-error API ─────────────────────────────

export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  const exit = Effect.runSyncExit(calculatePricingEffect(prixNetVendeur, commissionRate));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    throw (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
  }
  return exit.value;
}

export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  const exit = Effect.runSyncExit(validatePrixTargetEffect(target, prixAffiche, tolerance));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    throw (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
  }
  return exit.value;
}

export function calculateBatchPricing(mandates: Array<{ prixNetVendeur: number; commissionRate: number }>) {
  const exit = Effect.runSyncExit(calculateBatchPricingEffect(mandates));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    throw (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
  }
  return exit.value;
}
