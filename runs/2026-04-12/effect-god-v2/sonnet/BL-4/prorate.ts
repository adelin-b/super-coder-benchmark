import { Effect, Data, Exit, Cause } from "effect";

// ── Internal tagged errors ────────────────────────────────────────────────────

class ProrateInternalError extends Data.TaggedError("ProrateInternalError")<{
  reason: string;
}> {}

// ── Public types ──────────────────────────────────────────────────────────────

export interface DateRange {
  /** ISO date string "YYYY-MM-DD" (inclusive) */
  start: string;
  /** ISO date string "YYYY-MM-DD" (inclusive) */
  end: string;
}

export interface PeriodCharge {
  /** The date range this charge covers */
  range: DateRange;
  /** Full-period amount (will be prorated to the billing period overlap) */
  amount: number;
}

export interface ProrationSegment {
  start: string;
  end: string;
  days: number;
  totalDays: number;
  fraction: number;
  amount: number;
}

export interface ProrationResult {
  segments: ProrationSegment[];
  total: number;
}

// ── Public error ──────────────────────────────────────────────────────────────

export class ProrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseUTC(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  return d;
}

function formatUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayCount(start: Date, end: Date): number {
  // inclusive on both ends
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function validateDateStr(s: string, label: string): void {
  const d = parseUTC(s);
  if (isNaN(d.getTime())) throw new ProrationError(`Invalid ${label}: "${s}"`);
}

// ── Core Effect logic ─────────────────────────────────────────────────────────

const prorateEffect = (
  billingPeriod: DateRange,
  charges: PeriodCharge[]
): Effect.Effect<ProrationResult, ProrateInternalError> =>
  Effect.gen(function* () {
    const bStart = parseUTC(billingPeriod.start);
    const bEnd = parseUTC(billingPeriod.end);

    if (bEnd.getTime() <= bStart.getTime()) {
      yield* Effect.fail(
        new ProrateInternalError({ reason: "Billing period end must be after start" })
      );
    }

    const totalDays = dayCount(bStart, bEnd);
    const segments: ProrationSegment[] = [];

    const sorted = [...charges].sort(
      (a, b) => parseUTC(a.range.start).getTime() - parseUTC(b.range.start).getTime()
    );

    for (const charge of sorted) {
      if (charge.amount < 0) {
        yield* Effect.fail(
          new ProrateInternalError({ reason: "Charge amount cannot be negative" })
        );
      }

      const cStart = parseUTC(charge.range.start);
      const cEnd = parseUTC(charge.range.end);

      if (cEnd.getTime() < cStart.getTime()) {
        yield* Effect.fail(
          new ProrateInternalError({ reason: "Charge range end must be on or after start" })
        );
      }

      // Intersect charge range with billing period
      const segStart = cStart < bStart ? bStart : cStart;
      const segEnd = cEnd > bEnd ? bEnd : cEnd;

      if (segStart.getTime() > segEnd.getTime()) {
        // No overlap with billing period — skip
        continue;
      }

      const days = dayCount(segStart, segEnd);
      const fraction = days / totalDays;
      const amount = roundCents(charge.amount * fraction);

      segments.push({
        start: formatUTC(segStart),
        end: formatUTC(segEnd),
        days,
        totalDays,
        fraction,
        amount,
      });
    }

    const total = roundCents(segments.reduce((sum, s) => sum + s.amount, 0));
    return { segments, total };
  });

// ── Boundary helper ───────────────────────────────────────────────────────────

function runProrate(
  billingPeriod: DateRange,
  charges: PeriodCharge[]
): ProrationResult {
  const exit = Effect.runSyncExit(prorateEffect(billingPeriod, charges));
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    throw new ProrationError(err instanceof Error ? err.message : String(err));
  }
  return exit.value;
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Prorate one or more charges against a billing period.
 *
 * Each charge's `amount` represents the full-period price; only the portion
 * that overlaps the `billingPeriod` is billed.  Charges outside the billing
 * period are silently ignored.
 *
 * @throws {ProrationError} on invalid dates, negative amounts, or empty charges.
 */
export function prorate(
  billingPeriod: DateRange,
  charges: PeriodCharge[]
): ProrationResult {
  // Input validation before Effect
  validateDateStr(billingPeriod.start, "billing period start");
  validateDateStr(billingPeriod.end, "billing period end");

  const bStart = parseUTC(billingPeriod.start);
  const bEnd = parseUTC(billingPeriod.end);
  if (bEnd.getTime() <= bStart.getTime()) {
    throw new ProrationError("Billing period end must be after start");
  }

  if (!charges || charges.length === 0) {
    throw new ProrationError("At least one charge is required");
  }

  for (const charge of charges) {
    validateDateStr(charge.range.start, "charge range start");
    validateDateStr(charge.range.end, "charge range end");
    if (charge.amount < 0) {
      throw new ProrationError("Charge amount cannot be negative");
    }
  }

  return runProrate(billingPeriod, charges);
}

/**
 * Prorate a monthly billing cycle split at a single change date.
 *
 * @param year       Full calendar year (e.g. 2024)
 * @param month      1–12
 * @param changeDate "YYYY-MM-DD" — the first day the new amount applies
 * @param oldAmount  Per-month charge before the change
 * @param newAmount  Per-month charge from changeDate onward
 *
 * @throws {ProrationError} on invalid arguments.
 */
export function prorateMonthly(
  year: number,
  month: number,
  changeDate: string,
  oldAmount: number,
  newAmount: number
): ProrationResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ProrationError("Month must be an integer between 1 and 12");
  }
  if (oldAmount < 0) throw new ProrationError("oldAmount cannot be negative");
  if (newAmount < 0) throw new ProrationError("newAmount cannot be negative");

  validateDateStr(changeDate, "changeDate");

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last of this month
  const changeD = parseUTC(changeDate);

  if (changeD.getTime() < firstDay.getTime() || changeD.getTime() > lastDay.getTime()) {
    throw new ProrationError("changeDate must fall within the specified billing month");
  }

  const start = formatUTC(firstDay);
  const end = formatUTC(lastDay);

  const charges: PeriodCharge[] = [];

  if (changeD.getTime() === firstDay.getTime()) {
    // Change on first day — only new amount applies
    charges.push({ range: { start, end }, amount: newAmount });
  } else {
    const dayBeforeChange = formatUTC(addDays(changeD, -1));
    charges.push({ range: { start, end: dayBeforeChange }, amount: oldAmount });
    charges.push({ range: { start: changeDate, end }, amount: newAmount });
  }

  return runProrate({ start, end }, charges);
}

/**
 * Split a DateRange into two non-overlapping ranges at `splitDate`.
 *
 * The first range spans `[period.start, splitDate - 1 day]`.
 * The second range spans `[splitDate, period.end]`.
 *
 * @throws {ProrationError} if splitDate is not strictly inside the period.
 */
export function splitPeriod(
  period: DateRange,
  splitDate: string
): [DateRange, DateRange] {
  validateDateStr(period.start, "period start");
  validateDateStr(period.end, "period end");
  validateDateStr(splitDate, "splitDate");

  const pStart = parseUTC(period.start);
  const pEnd = parseUTC(period.end);
  const split = parseUTC(splitDate);

  if (pEnd.getTime() < pStart.getTime()) {
    throw new ProrationError("Period end must be on or after period start");
  }
  if (split.getTime() <= pStart.getTime() || split.getTime() > pEnd.getTime()) {
    throw new ProrationError(
      "splitDate must be strictly after period start and on or before period end"
    );
  }

  const dayBeforeSplit = formatUTC(addDays(split, -1));

  return [
    { start: period.start, end: dayBeforeSplit },
    { start: splitDate, end: period.end },
  ];
}

/**
 * Calculate the prorated daily rate for a given amount and date range.
 *
 * @param amount    Full-period charge
 * @param dateRange The period over which `amount` applies
 * @returns         Amount per day (rounded to 6 decimal places)
 *
 * @throws {ProrationError} on invalid dates or negative amount.
 */
export function dailyRate(amount: number, dateRange: DateRange): number {
  validateDateStr(dateRange.start, "start");
  validateDateStr(dateRange.end, "end");

  if (amount < 0) throw new ProrationError("Amount cannot be negative");

  const start = parseUTC(dateRange.start);
  const end = parseUTC(dateRange.end);

  if (end.getTime() < start.getTime()) {
    throw new ProrationError("Date range end must be on or after start");
  }

  const days = dayCount(start, end);
  return Math.round((amount / days) * 1_000_000) / 1_000_000;
}

/**
 * Compute how many days of a billing period fall within a given date range.
 *
 * Useful for manual proration calculations.
 *
 * @throws {ProrationError} on invalid dates.
 */
export function overlapDays(billingPeriod: DateRange, range: DateRange): number {
  validateDateStr(billingPeriod.start, "billing period start");
  validateDateStr(billingPeriod.end, "billing period end");
  validateDateStr(range.start, "range start");
  validateDateStr(range.end, "range end");

  const bStart = parseUTC(billingPeriod.start);
  const bEnd = parseUTC(billingPeriod.end);
  const rStart = parseUTC(range.start);
  const rEnd = parseUTC(range.end);

  if (bEnd.getTime() < bStart.getTime()) {
    throw new ProrationError("Billing period end must be on or after start");
  }
  if (rEnd.getTime() < rStart.getTime()) {
    throw new ProrationError("Range end must be on or after start");
  }

  const overlapStart = rStart < bStart ? bStart : rStart;
  const overlapEnd = rEnd > bEnd ? bEnd : rEnd;

  if (overlapStart.getTime() > overlapEnd.getTime()) return 0;
  return dayCount(overlapStart, overlapEnd);
}