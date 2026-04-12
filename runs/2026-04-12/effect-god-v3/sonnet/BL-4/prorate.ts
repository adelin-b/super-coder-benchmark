import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain invariants ───────────────────────────────────────────────────────
// ∀ valid ProrationResult: sum(segment.amount) === totalAmount (conservation)
// ∀ valid ProrationResult: sum(segment.ratio) === 1 and each ratio ∈ [0,1] (bounds)
// ∀ valid ProrationResult: sum(segment.days) === totalDays (day consistency)

// ─── Public error ─────────────────────────────────────────────────────────────
export class ProrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrationError";
    Object.setPrototypeOf(this, ProrationError.prototype);
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────
export interface ProratedSegment {
  startDate: Date;
  endDate: Date;
  days: number;
  totalDays: number;
  ratio: number;
  amount: number;
}

export interface ProrationResult {
  segments: ProratedSegment[];
  totalAmount: number;
  periodStart: Date;
  periodEnd: Date;
  totalDays: number;
}

export interface ChargeEvent {
  amount: number;
  effectiveDate: string | Date;
}

// ─── Internal tagged errors ───────────────────────────────────────────────────
class InternalProrationError extends Data.TaggedError("InternalProrationError")<{
  reason: string;
}> {}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDate(d: string | Date): Date {
  if (d instanceof Date) return new Date(d.getTime());
  return new Date(d.includes("T") ? d : d + "T00:00:00Z");
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Round to cents, ensuring last segment absorbs rounding remainder
function distributeAmounts(totalAmount: number, ratios: number[]): number[] {
  let allocated = 0;
  const amounts = ratios.map((r, i) => {
    if (i === ratios.length - 1) {
      return Math.round((totalAmount - allocated) * 100) / 100;
    }
    const a = Math.round(totalAmount * r * 100) / 100;
    allocated += a;
    return a;
  });
  return amounts;
}

// ─── Internal Effect logic ────────────────────────────────────────────────────
const validatePeriod = (
  periodStart: Date,
  periodEnd: Date
): Effect.Effect<number, InternalProrationError> =>
  Effect.gen(function* () {
    const totalDays = daysBetween(periodStart, periodEnd);
    if (totalDays <= 0) {
      yield* Effect.fail(
        new InternalProrationError({
          reason: "periodEnd must be after periodStart",
        })
      );
    }
    return totalDays;
  });

const validateAmount = (
  amount: number
): Effect.Effect<void, InternalProrationError> =>
  Effect.gen(function* () {
    if (amount < 0) {
      yield* Effect.fail(
        new InternalProrationError({ reason: "amount must be non-negative" })
      );
    }
  });

const prorateChargeEffect = (
  amount: number,
  periodStart: Date,
  periodEnd: Date,
  changeDate?: Date
): Effect.Effect<ProrationResult, InternalProrationError> =>
  Effect.gen(function* () {
    yield* validateAmount(amount);
    const totalDays = yield* validatePeriod(periodStart, periodEnd);

    if (changeDate === undefined) {
      // Single segment covers the whole period
      const segment: ProratedSegment = {
        startDate: new Date(periodStart),
        endDate: new Date(periodEnd),
        days: totalDays,
        totalDays,
        ratio: 1,
        amount,
      };
      return {
        segments: [segment],
        totalAmount: amount,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalDays,
      };
    }

    const clampedChange = new Date(
      Math.max(
        periodStart.getTime(),
        Math.min(periodEnd.getTime(), changeDate.getTime())
      )
    );

    const daysFirst = daysBetween(periodStart, clampedChange);
    const daysSecond = daysBetween(clampedChange, periodEnd);

    if (daysFirst < 0 || daysSecond < 0) {
      yield* Effect.fail(
        new InternalProrationError({
          reason: "changeDate produced negative segment days",
        })
      );
    }

    const ratioFirst = totalDays > 0 ? daysFirst / totalDays : 0;
    const ratioSecond = totalDays > 0 ? daysSecond / totalDays : 0;

    const [amtFirst, amtSecond] = distributeAmounts(amount, [
      ratioFirst,
      ratioSecond,
    ]);

    const segments: ProratedSegment[] = [];

    if (daysFirst > 0) {
      segments.push({
        startDate: new Date(periodStart),
        endDate: new Date(clampedChange),
        days: daysFirst,
        totalDays,
        ratio: ratioFirst,
        amount: amtFirst,
      });
    }

    if (daysSecond > 0) {
      segments.push({
        startDate: new Date(clampedChange),
        endDate: new Date(periodEnd),
        days: daysSecond,
        totalDays,
        ratio: ratioSecond,
        amount: amtSecond,
      });
    }

    // If changeDate == periodStart or == periodEnd, we may have a single segment
    if (segments.length === 0) {
      segments.push({
        startDate: new Date(periodStart),
        endDate: new Date(periodEnd),
        days: totalDays,
        totalDays,
        ratio: 1,
        amount,
      });
    }

    const totalAmount = segments.reduce((s, seg) => s + seg.amount, 0);

    return {
      segments,
      totalAmount,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalDays,
    };
  });

const calculateProrationEffect = (
  periodStart: Date,
  periodEnd: Date,
  charges: ChargeEvent[]
): Effect.Effect<ProrationResult, InternalProrationError> =>
  Effect.gen(function* () {
    if (charges.length === 0) {
      yield* Effect.fail(
        new InternalProrationError({
          reason: "charges must contain at least one entry",
        })
      );
    }

    const totalDays = yield* validatePeriod(periodStart, periodEnd);

    // Sort charges by effectiveDate ascending
    const sorted = [...charges]
      .map((c) => ({ amount: c.amount, date: toDate(c.effectiveDate) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Build time windows within the period
    interface Window {
      start: Date;
      end: Date;
      amount: number;
    }

    const windows: Window[] = [];

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].amount < 0) {
        yield* Effect.fail(
          new InternalProrationError({ reason: "amount must be non-negative" })
        );
      }

      const windowStart = new Date(
        Math.max(periodStart.getTime(), sorted[i].date.getTime())
      );
      const windowEnd =
        i + 1 < sorted.length
          ? new Date(
              Math.min(periodEnd.getTime(), sorted[i + 1].date.getTime())
            )
          : new Date(periodEnd);

      if (windowEnd.getTime() <= windowStart.getTime()) continue;

      windows.push({
        start: windowStart,
        end: windowEnd,
        amount: sorted[i].amount,
      });
    }

    if (windows.length === 0) {
      yield* Effect.fail(
        new InternalProrationError({
          reason: "no charge windows fall within the billing period",
        })
      );
    }

    // Compute each window's prorated contribution to the full period total
    // Each window contributes: amount * (windowDays / totalDays)
    const segments: ProratedSegment[] = [];
    let runningTotal = 0;

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const days = daysBetween(w.start, w.end);
      const ratio = days / totalDays;
      const isLast = i === windows.length - 1;
      const rawAmt = w.amount * ratio;
      const amt = isLast
        ? Math.round((w.amount * ratio) * 100) / 100
        : Math.round(rawAmt * 100) / 100;

      segments.push({
        startDate: new Date(w.start),
        endDate: new Date(w.end),
        days,
        totalDays,
        ratio,
        amount: amt,
      });

      runningTotal += amt;
    }

    return {
      segments,
      totalAmount: Math.round(runningTotal * 100) / 100,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalDays,
    };
  });

// ─── Boundary helpers ─────────────────────────────────────────────────────────
function runOrThrow<A>(
  eff: Effect.Effect<A, InternalProrationError>
): A {
  const exit = Effect.runSyncExit(eff);
  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    const msg =
      raw instanceof Error
        ? raw.message
        : (raw as any).reason ?? String(raw);
    throw new ProrationError(msg);
  }
  return exit.value;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prorate a single charge amount across a billing period.
 * If `changeDate` is provided, splits the period at that date into two segments.
 */
export function prorateCharge(
  amount: number,
  periodStart: string | Date,
  periodEnd: string | Date,
  changeDate?: string | Date
): ProrationResult {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new ProrationError("amount must be a valid number");
  }
  if (amount < 0) {
    throw new ProrationError("amount must be non-negative");
  }

  const start = toDate(periodStart);
  const end = toDate(periodEnd);
  const change = changeDate !== undefined ? toDate(changeDate) : undefined;

  return runOrThrow(prorateChargeEffect(amount, start, end, change));
}

/**
 * Calculate prorated amounts when charges change mid-period.
 * Each charge in `charges` takes effect on its `effectiveDate`.
 * The first charge that falls on or before `periodStart` governs the beginning.
 */
export function calculateProration(options: {
  periodStart: string | Date;
  periodEnd: string | Date;
  charges: ChargeEvent[];
}): ProrationResult {
  const { periodStart, periodEnd, charges } = options;

  if (!Array.isArray(charges) || charges.length === 0) {
    throw new ProrationError("charges must contain at least one entry");
  }

  const start = toDate(periodStart);
  const end = toDate(periodEnd);

  return runOrThrow(calculateProrationEffect(start, end, charges));
}

/**
 * Compute the raw proration ratio for a portion of days.
 * Returns a value in [0, 1].
 */
export function prorationRatio(daysUsed: number, totalDays: number): number {
  if (totalDays <= 0) {
    throw new ProrationError("totalDays must be greater than 0");
  }
  if (daysUsed < 0) {
    throw new ProrationError("daysUsed must be non-negative");
  }
  return Math.min(1, daysUsed / totalDays);
}

/**
 * Compute how many days remain in a billing period from a given date.
 */
export function daysRemaining(
  fromDate: string | Date,
  periodEnd: string | Date
): number {
  const from = toDate(fromDate);
  const end = toDate(periodEnd);
  const days = daysBetween(from, end);
  return Math.max(0, days);
}

/**
 * Compute how many days have elapsed in a billing period up to a given date.
 */
export function daysElapsed(
  periodStart: string | Date,
  toDateArg: string | Date
): number {
  const start = toDate(periodStart);
  const to = toDate(toDateArg);
  const days = daysBetween(start, to);
  return Math.max(0, days);
}

/**
 * Compute the total number of days in a billing period.
 */
export function periodDays(
  periodStart: string | Date,
  periodEnd: string | Date
): number {
  const start = toDate(periodStart);
  const end = toDate(periodEnd);
  const days = daysBetween(start, end);
  if (days < 0) {
    throw new ProrationError("periodEnd must be after periodStart");
  }
  return days;
}