import { Effect, Data, Exit, Cause, pipe } from "effect";

// ─── Public Error ───────────────────────────────────────────────────────────

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrateError";
    Object.setPrototypeOf(this, ProrateError.prototype);
  }
}

// ─── Public Types ────────────────────────────────────────────────────────────

export interface ProrateSegment {
  /** Inclusive start date of this segment (ISO date string, e.g. "2024-03-01") */
  start: string;
  /** Exclusive end date of this segment */
  end: string;
  /** Number of days in this segment */
  days: number;
  /** Fraction of the total billing period this segment covers (0–1) */
  weight: number;
  /** Prorated amount for this segment, rounded to 2 decimal places */
  amount: number;
}

export interface ProrateResult {
  /** Individual segments (one per rate/amount change) */
  segments: ProrateSegment[];
  /** Total days in the billing period */
  totalDays: number;
  /** Sum of all segment amounts (may differ from input totalAmount by ±$0.01 due to rounding) */
  totalAmount: number;
}

/**
 * A rate that applies from `start` (inclusive) until the next entry's start
 * (or the billing period end).
 */
export interface RateChange {
  /** ISO date string for when this rate takes effect */
  effectiveDate: string;
  /** The charge amount for this rate */
  amount: number;
}

export interface ProrateInput {
  /** ISO date string — inclusive start of the billing period */
  periodStart: string;
  /** ISO date string — exclusive end of the billing period */
  periodEnd: string;
  /**
   * Rate schedule: each entry specifies an amount that takes effect on
   * `effectiveDate`. Must contain at least one entry whose effectiveDate ≤
   * periodStart, or at least one entry overall. Entries are sorted internally.
   */
  rates: RateChange[];
}

// ─── Internal Errors ─────────────────────────────────────────────────────────

class InternalProrateError extends Data.TaggedError("InternalProrateError")<{
  reason: string;
}> {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse an ISO date string as UTC midnight, returning epoch milliseconds. */
function parseDate(s: string): number {
  // Accept "YYYY-MM-DD" or full ISO strings
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T00:00:00Z" : s;
  const ms = Date.parse(clean);
  if (isNaN(ms)) throw new Error(`Invalid date: "${s}"`);
  return ms;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / MS_PER_DAY);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Internal Effect ──────────────────────────────────────────────────────────

const computeProration = (
  input: ProrateInput
): Effect.Effect<ProrateResult, InternalProrateError> =>
  Effect.gen(function* () {
    // 1. Parse period boundaries
    let periodStartMs: number;
    let periodEndMs: number;
    try {
      periodStartMs = parseDate(input.periodStart);
      periodEndMs = parseDate(input.periodEnd);
    } catch (e) {
      yield* Effect.fail(
        new InternalProrateError({ reason: (e as Error).message })
      );
      return undefined as never;
    }

    if (periodEndMs <= periodStartMs) {
      yield* Effect.fail(
        new InternalProrateError({
          reason: "periodEnd must be after periodStart",
        })
      );
    }

    const totalDays = daysBetween(periodStartMs, periodEndMs);
    if (totalDays <= 0) {
      yield* Effect.fail(
        new InternalProrateError({ reason: "Billing period has zero days" })
      );
    }

    // 2. Validate rates
    if (!input.rates || input.rates.length === 0) {
      yield* Effect.fail(
        new InternalProrateError({ reason: "rates must contain at least one entry" })
      );
    }

    // 3. Parse & sort rate entries
    let parsedRates: { ms: number; amount: number; effectiveDate: string }[];
    try {
      parsedRates = input.rates.map((r) => ({
        ms: parseDate(r.effectiveDate),
        amount: r.amount,
        effectiveDate: r.effectiveDate,
      }));
    } catch (e) {
      yield* Effect.fail(
        new InternalProrateError({ reason: (e as Error).message })
      );
      return undefined as never;
    }

    parsedRates.sort((a, b) => a.ms - b.ms);

    // 4. Validate amounts
    for (const r of parsedRates) {
      if (r.amount < 0) {
        yield* Effect.fail(
          new InternalProrateError({ reason: "Rate amount must not be negative" })
        );
      }
    }

    // 5. Build segments clipped to [periodStart, periodEnd)
    const segments: ProrateSegment[] = [];

    for (let i = 0; i < parsedRates.length; i++) {
      const rate = parsedRates[i];
      const nextRate = parsedRates[i + 1];

      // Segment runs from max(rate.ms, periodStartMs) to min(nextRate.ms or periodEndMs, periodEndMs)
      const segStart = Math.max(rate.ms, periodStartMs);
      const segEnd = nextRate
        ? Math.min(nextRate.ms, periodEndMs)
        : periodEndMs;

      if (segEnd <= segStart) continue; // this rate is outside the billing period

      const days = daysBetween(segStart, segEnd);
      if (days <= 0) continue;

      const weight = days / totalDays;
      const amount = round2(rate.amount * weight);

      // Convert back to ISO date strings (YYYY-MM-DD)
      const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

      segments.push({
        start: toISO(segStart),
        end: toISO(segEnd),
        days,
        weight: round2(weight),
        amount,
      });
    }

    if (segments.length === 0) {
      yield* Effect.fail(
        new InternalProrateError({
          reason: "No rate entries overlap with the billing period",
        })
      );
    }

    const totalAmount = round2(segments.reduce((sum, s) => sum + s.amount, 0));

    return { segments, totalDays, totalAmount } satisfies ProrateResult;
  });

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute prorated amounts for a billing period with one or more rate changes.
 *
 * @example
 * // Monthly plan at $30, customer upgrades to $50 on the 16th of a 30-day month
 * prorate({
 *   periodStart: "2024-03-01",
 *   periodEnd:   "2024-04-01",
 *   rates: [
 *     { effectiveDate: "2024-03-01", amount: 30 },
 *     { effectiveDate: "2024-03-16", amount: 50 },
 *   ],
 * })
 */
export function prorate(input: ProrateInput): ProrateResult {
  // ── Input validation (before Effect) ──
  if (!input || typeof input !== "object") {
    throw new ProrateError("Input must be an object");
  }
  if (!input.periodStart || typeof input.periodStart !== "string") {
    throw new ProrateError("periodStart is required and must be a string");
  }
  if (!input.periodEnd || typeof input.periodEnd !== "string") {
    throw new ProrateError("periodEnd is required and must be a string");
  }
  if (!Array.isArray(input.rates) || input.rates.length === 0) {
    throw new ProrateError("rates must be a non-empty array");
  }

  const exit = Effect.runSyncExit(computeProration(input));

  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    const msg =
      raw instanceof Error
        ? raw.message
        : (raw as { reason?: string }).reason ?? String(raw);
    throw new ProrateError(msg);
  }

  return exit.value;
}

/**
 * Simplified helper: prorate a single charge amount for a partial period.
 *
 * @param totalAmount  - Full-period charge (e.g. monthly price)
 * @param periodStart  - ISO date string: inclusive start of billing period
 * @param periodEnd    - ISO date string: exclusive end of billing period
 * @param effectiveStart - ISO date string: when the charge begins (≥ periodStart)
 * @param effectiveEnd   - ISO date string: when the charge ends (≤ periodEnd); defaults to periodEnd
 * @returns Prorated amount rounded to 2 decimal places
 */
export function prorateAmount(
  totalAmount: number,
  periodStart: string,
  periodEnd: string,
  effectiveStart: string,
  effectiveEnd?: string
): number {
  if (totalAmount < 0) {
    throw new ProrateError("totalAmount must not be negative");
  }

  const resolvedEnd = effectiveEnd ?? periodEnd;

  const result = prorate({
    periodStart,
    periodEnd,
    rates: [
      { effectiveDate: periodStart, amount: 0 },
      { effectiveDate: effectiveStart, amount: totalAmount },
      ...(resolvedEnd < periodEnd
        ? [{ effectiveDate: resolvedEnd, amount: 0 }]
        : []),
    ],
  });

  // Sum only segments that belong to [effectiveStart, resolvedEnd)
  return result.segments
    .filter((s) => s.start >= effectiveStart && s.end <= resolvedEnd)
    .reduce((sum, s) => round2(sum + s.amount), 0);
}

/**
 * Calculate how many days a billing period spans.
 * Useful for building rate schedules.
 */
export function periodDays(periodStart: string, periodEnd: string): number {
  let startMs: number, endMs: number;
  try {
    startMs = parseDate(periodStart);
    endMs = parseDate(periodEnd);
  } catch {
    throw new ProrateError(`Invalid date in periodDays`);
  }
  if (endMs <= startMs) {
    throw new ProrateError("periodEnd must be after periodStart");
  }
  return daysBetween(startMs, endMs);
}