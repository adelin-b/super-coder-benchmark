import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrateError";
    Object.setPrototypeOf(this, ProrateError.prototype);
  }
}

// ─── Internal Tagged Errors ───────────────────────────────────────────────────

class InternalProrateError extends Data.TaggedError("InternalProrateError")<{
  reason: string;
}> {}

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ProrateOptions {
  /** Total charge to split across the period */
  totalCharge: number;
  /** Start of the billing period (inclusive) */
  periodStart: Date | string;
  /** End of the billing period (exclusive) */
  periodEnd: Date | string;
  /** The date at which the change occurs within the period */
  changeDate: Date | string;
}

export interface ProratedResult {
  /** Charge allocated to the portion before changeDate */
  beforeChange: number;
  /** Charge allocated to the portion from changeDate onward */
  afterChange: number;
  /** Total days in the billing period */
  totalDays: number;
  /** Days from periodStart up to (but not including) changeDate */
  daysBeforeChange: number;
  /** Days from changeDate to periodEnd */
  daysAfterChange: number;
}

export interface ProrateAmountResult {
  /** The prorated charge */
  amount: number;
  /** Days used in the computation */
  daysUsed: number;
  /** Total days in the period */
  totalDays: number;
}

export interface PeriodSlice {
  start: Date | string;
  end: Date | string;
  /** Weight relative to other slices (defaults to 1) */
  weight?: number;
}

export interface MultiSliceOptions {
  totalCharge: number;
  slices: PeriodSlice[];
}

export interface SliceAllocation {
  start: Date;
  end: Date;
  days: number;
  weight: number;
  amount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(value: Date | string, label: string): Date {
  if (value instanceof Date) return new Date(value);
  const d = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value + "T00:00:00Z"
    : value);
  if (isNaN(d.getTime())) throw new ProrateError(`Invalid date for '${label}': ${value}`);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function roundHalf(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Internal Effect Logic ────────────────────────────────────────────────────

const computeProrate = (opts: ProrateOptions): Effect.Effect<ProratedResult, InternalProrateError> =>
  Effect.gen(function* () {
    const start = parseDate(opts.periodStart, "periodStart");
    const end = parseDate(opts.periodEnd, "periodEnd");
    const change = parseDate(opts.changeDate, "changeDate");

    const totalDays = daysBetween(start, end);
    if (totalDays <= 0) {
      yield* Effect.fail(new InternalProrateError({ reason: "periodEnd must be after periodStart" }));
    }
    if (change < start || change > end) {
      yield* Effect.fail(new InternalProrateError({ reason: "changeDate must be within the billing period" }));
    }

    const daysBeforeChange = daysBetween(start, change);
    const daysAfterChange = totalDays - daysBeforeChange;

    const beforeRaw = (opts.totalCharge * daysBeforeChange) / totalDays;
    const beforeChange = roundHalf(beforeRaw);
    const afterChange = roundHalf(opts.totalCharge - beforeChange);

    return { beforeChange, afterChange, totalDays, daysBeforeChange, daysAfterChange };
  });

const computeProrateAmount = (
  totalCharge: number,
  daysUsed: number,
  totalDays: number
): Effect.Effect<ProrateAmountResult, InternalProrateError> =>
  Effect.gen(function* () {
    if (totalDays <= 0) {
      yield* Effect.fail(new InternalProrateError({ reason: "totalDays must be greater than 0" }));
    }
    if (daysUsed < 0) {
      yield* Effect.fail(new InternalProrateError({ reason: "daysUsed cannot be negative" }));
    }
    if (daysUsed > totalDays) {
      yield* Effect.fail(new InternalProrateError({ reason: "daysUsed cannot exceed totalDays" }));
    }
    const amount = roundHalf((totalCharge * daysUsed) / totalDays);
    return { amount, daysUsed, totalDays };
  });

const computeMultiSlice = (opts: MultiSliceOptions): Effect.Effect<SliceAllocation[], InternalProrateError> =>
  Effect.gen(function* () {
    if (!opts.slices || opts.slices.length === 0) {
      yield* Effect.fail(new InternalProrateError({ reason: "slices array must not be empty" }));
    }

    const parsed = opts.slices.map((s, i) => ({
      start: parseDate(s.start, `slices[${i}].start`),
      end: parseDate(s.end, `slices[${i}].end`),
      weight: s.weight ?? 1,
    }));

    for (let i = 0; i < parsed.length; i++) {
      const s = parsed[i];
      if (s.end <= s.start) {
        yield* Effect.fail(new InternalProrateError({ reason: `slice[${i}].end must be after start` }));
      }
      if (s.weight <= 0) {
        yield* Effect.fail(new InternalProrateError({ reason: `slice[${i}].weight must be positive` }));
      }
    }

    const weighted = parsed.map((s) => ({
      ...s,
      days: daysBetween(s.start, s.end),
      weightedDays: daysBetween(s.start, s.end) * s.weight,
    }));

    const totalWeightedDays = weighted.reduce((sum, s) => sum + s.weightedDays, 0);
    if (totalWeightedDays === 0) {
      yield* Effect.fail(new InternalProrateError({ reason: "total weighted days must be greater than 0" }));
    }

    // Allocate with last-item adjustment to preserve conservation invariant
    let allocated = 0;
    const allocations: SliceAllocation[] = [];
    for (let i = 0; i < weighted.length; i++) {
      const s = weighted[i];
      const isLast = i === weighted.length - 1;
      const amount = isLast
        ? roundHalf(opts.totalCharge - allocated)
        : roundHalf((opts.totalCharge * s.weightedDays) / totalWeightedDays);
      allocated += amount;
      allocations.push({ start: s.start, end: s.end, days: s.days, weight: s.weight, amount });
    }

    return allocations;
  });

// ─── Boundary Helpers ─────────────────────────────────────────────────────────

function runEffect<A>(eff: Effect.Effect<A, InternalProrateError>): A {
  const exit = Effect.runSyncExit(eff);
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof InternalProrateError) {
      throw new ProrateError(err.reason);
    }
    if (err instanceof ProrateError) throw err;
    if (err instanceof Error) throw new ProrateError(err.message);
    throw new ProrateError(String(err));
  }
  return exit.value;
}

// ─── Public Exports ───────────────────────────────────────────────────────────

/**
 * Split a charge at a single change point within a billing period.
 *
 * Invariants:
 *   ∀ valid inputs: beforeChange + afterChange === totalCharge (±0.01 rounding)
 *   ∀ valid inputs: daysBeforeChange + daysAfterChange === totalDays
 *   ∀ valid inputs: amounts are non-negative when totalCharge ≥ 0
 */
export function prorate(options: ProrateOptions): ProratedResult {
  if (options.totalCharge < 0) {
    throw new ProrateError("totalCharge must be non-negative");
  }
  return runEffect(computeProrate(options));
}

/**
 * Prorate a charge based on days-used vs total-days in a period.
 *
 * Invariant: ∀ valid inputs: 0 ≤ amount ≤ totalCharge when totalCharge ≥ 0
 */
export function prorateAmount(
  totalCharge: number,
  daysUsed: number,
  totalDays: number
): ProrateAmountResult {
  if (totalCharge < 0) throw new ProrateError("totalCharge must be non-negative");
  if (!Number.isFinite(totalCharge)) throw new ProrateError("totalCharge must be a finite number");
  return runEffect(computeProrateAmount(totalCharge, daysUsed, totalDays));
}

/**
 * Split a charge proportionally across multiple time slices (with optional weights).
 *
 * Invariant: ∀ valid inputs: sum(allocations[i].amount) === totalCharge (±0.01)
 */
export function prorateMultiSlice(options: MultiSliceOptions): SliceAllocation[] {
  if (options.totalCharge < 0) throw new ProrateError("totalCharge must be non-negative");
  if (!options.slices || options.slices.length === 0) {
    throw new ProrateError("slices array must not be empty");
  }
  return runEffect(computeMultiSlice(options));
}

/**
 * Convenience: calculate a daily rate from a periodic charge.
 *
 * Invariant: ∀ valid inputs: dailyRate * periodDays ≈ periodCharge
 */
export function dailyRate(periodCharge: number, periodDays: number): number {
  if (periodCharge < 0) throw new ProrateError("periodCharge must be non-negative");
  if (periodDays <= 0) throw new ProrateError("periodDays must be greater than 0");
  if (!Number.isFinite(periodCharge)) throw new ProrateError("periodCharge must be a finite number");
  return roundHalf(periodCharge / periodDays);
}

/**
 * Factory: create a reusable proration calculator bound to a specific billing period.
 */
export function createProrater(periodStart: Date | string, periodEnd: Date | string) {
  const start = parseDate(periodStart, "periodStart");
  const end = parseDate(periodEnd, "periodEnd");
  const totalDays = daysBetween(start, end);
  if (totalDays <= 0) throw new ProrateError("periodEnd must be after periodStart");

  return {
    /** Total days in this billing period */
    totalDays(): number {
      return totalDays;
    },

    /** Calculate prorated amount for a sub-period within this billing period */
    forPeriod(subStart: Date | string, subEnd: Date | string, totalCharge: number): ProrateAmountResult {
      if (totalCharge < 0) throw new ProrateError("totalCharge must be non-negative");
      const sStart = parseDate(subStart, "subStart");
      const sEnd = parseDate(subEnd, "subEnd");
      const days = daysBetween(sStart, sEnd);
      if (days < 0) throw new ProrateError("subEnd must not be before subStart");
      return runEffect(computeProrateAmount(totalCharge, days, totalDays));
    },

    /** Split a charge at the given change date */
    splitAt(changeDate: Date | string, totalCharge: number): ProratedResult {
      if (totalCharge < 0) throw new ProrateError("totalCharge must be non-negative");
      return runEffect(
        computeProrate({ totalCharge, periodStart: start, periodEnd: end, changeDate })
      );
    },

    /** Daily rate for a given periodic charge */
    dailyRate(periodCharge: number): number {
      return dailyRate(periodCharge, totalDays);
    },
  };
}