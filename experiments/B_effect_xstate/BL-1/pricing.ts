/**
 * Method B: Effect TS + XState v5 — BL-1 Mandate Pricing Engine
 * Self-Healing Code with typed error channels and state machines.
 */
import { Effect, Schema, pipe } from 'effect';
import { createMachine, createActor } from 'xstate';

// ─── Domain Types ───────────────────────────────────────────────────

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

// ─── Typed Errors ───────────────────────────────────────────────────

export class PricingError extends Error {
  readonly _tag = 'PricingError';
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

export class ValidationError extends PricingError {
  constructor(field: string, reason: string) {
    super(`${field}: ${reason}`);
  }
}

// ─── Schema Validation ─────────────────────────────────────────────

const PricingInputSchema = Schema.Struct({
  prixNetVendeur: Schema.Number,
  commissionRate: Schema.Number,
});

type PricingInput = typeof PricingInputSchema.Type;

// ─── Pure Functions (Effect-wrapped) ────────────────────────────────

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateInput(prixNetVendeur: number, commissionRate: number): Effect.Effect<PricingInput, PricingError> {
  return Effect.gen(function* () {
    if (typeof prixNetVendeur !== 'number' || isNaN(prixNetVendeur)) {
      return yield* Effect.fail(new ValidationError('prixNetVendeur', 'must be a valid number'));
    }
    if (typeof commissionRate !== 'number' || isNaN(commissionRate)) {
      return yield* Effect.fail(new ValidationError('commissionRate', 'must be a valid number'));
    }
    if (prixNetVendeur <= 0) {
      return yield* Effect.fail(new ValidationError('prixNetVendeur', 'must be greater than 0'));
    }
    if (commissionRate < 0 || commissionRate >= 1) {
      return yield* Effect.fail(new ValidationError('commissionRate', 'must be in [0, 1)'));
    }
    return { prixNetVendeur, commissionRate };
  });
}

function computePricing(input: PricingInput): Effect.Effect<PricingResult, never> {
  return Effect.succeed({
    prixAffiche: roundTo2(input.prixNetVendeur / (1 - input.commissionRate)),
    vendorShare: roundTo2(input.prixNetVendeur),
    commissionShare: roundTo2(
      roundTo2(input.prixNetVendeur / (1 - input.commissionRate)) - roundTo2(input.prixNetVendeur)
    ),
  });
}

// ─── XState Pricing Machine ────────────────────────────────────────

export const pricingMachine = createMachine({
  id: 'pricing',
  initial: 'idle',
  context: {} as { input?: PricingInput; result?: PricingResult; error?: string },
  states: {
    idle: { on: { CALCULATE: 'validating' } },
    validating: { on: { VALID: 'computing', INVALID: 'error' } },
    computing: { on: { DONE: 'success' } },
    success: { type: 'final' as const },
    error: { type: 'final' as const },
  },
});

// ─── Effect Pipelines ──────────────────────────────────────────────

export function calculatePricingEffect(
  prixNetVendeur: number,
  commissionRate: number
): Effect.Effect<PricingResult, PricingError> {
  return pipe(
    validateInput(prixNetVendeur, commissionRate),
    Effect.flatMap(computePricing),
  );
}

export function validatePrixTargetEffect(
  target: number,
  prixAffiche: number,
  tolerance: number
): Effect.Effect<boolean, PricingError> {
  return Effect.gen(function* () {
    if (typeof target !== 'number' || isNaN(target)) {
      return yield* Effect.fail(new ValidationError('target', 'must be a valid number'));
    }
    if (typeof prixAffiche !== 'number' || isNaN(prixAffiche)) {
      return yield* Effect.fail(new ValidationError('prixAffiche', 'must be a valid number'));
    }
    if (typeof tolerance !== 'number' || isNaN(tolerance) || tolerance < 0) {
      return yield* Effect.fail(new ValidationError('tolerance', 'must be a non-negative number'));
    }
    return Math.abs(target - prixAffiche) <= tolerance;
  });
}

export function calculateBatchPricingEffect(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): Effect.Effect<BatchPricingResult, PricingError> {
  return Effect.gen(function* () {
    if (!Array.isArray(mandates)) {
      return yield* Effect.fail(new PricingError('mandates must be an array'));
    }
    const results: PricingResult[] = [];
    for (let i = 0; i < mandates.length; i++) {
      const m = mandates[i];
      const result = yield* pipe(
        calculatePricingEffect(m.prixNetVendeur, m.commissionRate),
        Effect.mapError((e) => new PricingError(`Mandate at index ${i}: ${e.message}`)),
      );
      results.push(result);
    }
    return {
      results,
      totalPrixAffiche: roundTo2(results.reduce((s, r) => s + r.prixAffiche, 0)),
      totalVendorShare: roundTo2(results.reduce((s, r) => s + r.vendorShare, 0)),
      totalCommissionShare: roundTo2(results.reduce((s, r) => s + r.commissionShare, 0)),
    };
  });
}

// ─── Synchronous API (runs Effect to throw on error) ────────────────

export function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  const exit = Effect.runSyncExit(calculatePricingEffect(prixNetVendeur, commissionRate));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    const err = (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
    throw err;
  }
  return exit.value;
}

export function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  const exit = Effect.runSyncExit(validatePrixTargetEffect(target, prixAffiche, tolerance));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    const err = (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
    throw err;
  }
  return exit.value;
}

export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): BatchPricingResult {
  const exit = Effect.runSyncExit(calculateBatchPricingEffect(mandates));
  if (exit._tag === 'Failure') {
    const cause = exit.cause;
    const err = (cause as any)?._tag === 'Fail' ? (cause as any).error : new PricingError('Unknown error');
    throw err;
  }
  return exit.value;
}
