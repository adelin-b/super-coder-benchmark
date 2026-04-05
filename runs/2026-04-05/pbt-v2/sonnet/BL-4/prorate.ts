/**
 * BL-4: Proration Calculator
 * Split a charge across time periods proportionally.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A half-open date interval [start, end). Both values are treated as calendar
 *  dates; time-of-day components are ignored. */
export interface DateRange {
  /** Inclusive start date. */
  start: Date;
  /** Exclusive end date. */
  end: Date;
}

/** A rate that becomes effective on a given date within a billing period. */
export interface ChargeChange {
  /** The date from which this amount applies (inclusive). */
  effectiveDate: Date;
  /** The charge (e.g. monthly price) for the remainder of the billing period. */
  amount: number;
}

/** The prorated portion assigned to one contiguous segment of a billing period. */
export interface ProratedSegment {
  /** The sub-interval this segment covers. */
  range: DateRange;
  /** Per-day rate used for this segment. */
  dailyRate: number;
  /** Number of calendar days in this segment. */
  days: number;
  /** Prorated charge for this segment (dailyRate × days). */
  amount: number;
}

/** Aggregated result returned by {@link splitCharge}. */
export interface ProrateResult {
  /** Individual prorated segments in chronological order. */
  segments: ProratedSegment[];
  /** Sum of all segment amounts. */
  totalAmount: number;
  /** Total calendar days covered (should equal days in the billing period). */
  totalDays: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Return the number of whole calendar days from `start` (inclusive) up to
 * `end` (exclusive), ignoring time-of-day and local timezone offsets.
 *
 * @example
 * daysBetween(new Date("2024-01-01"), new Date("2024-01-31")) // 30
 */
export function daysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endUtc = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );
  return Math.round((endUtc - startUtc) / MS_PER_DAY);
}

/**
 * Return the number of days in the calendar month containing `date`.
 *
 * @example
 * daysInMonth(2024, 1) // 29  (2024 is a leap year, month is 0-indexed)
 */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the *next* month equals the last day of the given month.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Clamp `date` so that it falls within `[range.start, range.end)`.
 * Returns `null` when the date is entirely outside the range.
 */
function clampToRange(date: Date, range: DateRange): Date | null {
  const startUtc = Date.UTC(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate()
  );
  const endUtc = Date.UTC(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate()
  );
  const dateUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (dateUtc <= startUtc) return range.start;
  if (dateUtc >= endUtc) return null;
  return date;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Compute the prorated share of `totalCharge` that corresponds to `subPeriod`
 * within the enclosing `billingPeriod`.
 *
 * The result is proportional to calendar days:
 * `totalCharge × (days(subPeriod) / days(billingPeriod))`.
 *
 * @param totalCharge - The full charge for the complete billing period.
 * @param billingPeriod - The full billing period [start, end).
 * @param subPeriod - The sub-interval to prorate for, clamped to billingPeriod.
 * @returns Prorated amount, or 0 if subPeriod does not overlap billingPeriod.
 *
 * @example
 * // 10 days of a 30-day month → one third of $90
 * prorateCharge(90, { start: jan1, end: jan31 }, { start: jan1, end: jan11 }) // 30
 */
export function prorateCharge(
  totalCharge: number,
  billingPeriod: DateRange,
  subPeriod: DateRange
): number {
  const totalDays = daysBetween(billingPeriod.start, billingPeriod.end);
  if (totalDays <= 0) return 0;

  // Intersect subPeriod with billingPeriod
  const subStartUtc = Math.max(
    Date.UTC(subPeriod.start.getFullYear(), subPeriod.start.getMonth(), subPeriod.start.getDate()),
    Date.UTC(billingPeriod.start.getFullYear(), billingPeriod.start.getMonth(), billingPeriod.start.getDate())
  );
  const subEndUtc = Math.min(
    Date.UTC(subPeriod.end.getFullYear(), subPeriod.end.getMonth(), subPeriod.end.getDate()),
    Date.UTC(billingPeriod.end.getFullYear(), billingPeriod.end.getMonth(), billingPeriod.end.getDate())
  );

  const subDays = Math.max(0, Math.round((subEndUtc - subStartUtc) / MS_PER_DAY));
  return (totalCharge * subDays) / totalDays;
}

/**
 * Split a billing period into prorated segments based on one or more mid-period
 * charge changes.
 *
 * Each {@link ChargeChange} in `changes` specifies a new flat `amount` that
 * becomes effective on `effectiveDate`. The daily rate is derived by dividing
 * that amount by the total days in the billing period, then multiplied by the
 * days in each resulting segment.
 *
 * Rules:
 * - `changes` must contain at least one entry whose `effectiveDate` ≤ the
 *   start of `billingPeriod` (this sets the initial rate).
 * - Changes with `effectiveDate` outside `billingPeriod` are ignored.
 * - Changes are sorted by `effectiveDate` automatically.
 *
 * @example
 * // Upgrade on the 11th of a 31-day month
 * splitCharge(
 *   { start: new Date("2024-01-01"), end: new Date("2024-02-01") },
 *   [
 *     { effectiveDate: new Date("2024-01-01"), amount: 31 },  // $1/day
 *     { effectiveDate: new Date("2024-01-11"), amount: 62 },  // $2/day after upgrade
 *   ]
 * )
 * // segments[0] → 10 days × $1 = $10
 * // segments[1] → 21 days × $2 = $42
 * // totalAmount  → $52
 */
export function splitCharge(
  billingPeriod: DateRange,
  changes: ReadonlyArray<ChargeChange>
): ProrateResult {
  const totalDays = daysBetween(billingPeriod.start, billingPeriod.end);

  if (totalDays <= 0 || changes.length === 0) {
    return { segments: [], totalAmount: 0, totalDays: 0 };
  }

  const periodStartUtc = Date.UTC(
    billingPeriod.start.getFullYear(),
    billingPeriod.start.getMonth(),
    billingPeriod.start.getDate()
  );
  const periodEndUtc = Date.UTC(
    billingPeriod.end.getFullYear(),
    billingPeriod.end.getMonth(),
    billingPeriod.end.getDate()
  );

  // Sort changes by effectiveDate ascending
  const sorted = [...changes].sort(
    (a, b) =>
      Date.UTC(a.effectiveDate.getFullYear(), a.effectiveDate.getMonth(), a.effectiveDate.getDate()) -
      Date.UTC(b.effectiveDate.getFullYear(), b.effectiveDate.getMonth(), b.effectiveDate.getDate())
  );

  // Determine the effective amount at the very start of the billing period
  // (last change whose effectiveDate <= billingPeriod.start)
  let initialAmount = 0;
  for (const ch of sorted) {
    const chUtc = Date.UTC(
      ch.effectiveDate.getFullYear(),
      ch.effectiveDate.getMonth(),
      ch.effectiveDate.getDate()
    );
    if (chUtc <= periodStartUtc) {
      initialAmount = ch.amount;
    }
  }

  // Build breakpoints: distinct dates within (periodStart, periodEnd) where
  // the charge changes, plus the period boundaries.
  interface Breakpoint {
    utc: number;
    date: Date;
    amount: number;
  }

  const breakpoints: Breakpoint[] = [
    { utc: periodStartUtc, date: billingPeriod.start, amount: initialAmount },
  ];

  for (const ch of sorted) {
    const chUtc = Date.UTC(
      ch.effectiveDate.getFullYear(),
      ch.effectiveDate.getMonth(),
      ch.effectiveDate.getDate()
    );
    // Only include changes strictly inside the billing period
    if (chUtc > periodStartUtc && chUtc < periodEndUtc) {
      breakpoints.push({ utc: chUtc, date: ch.effectiveDate, amount: ch.amount });
    }
  }

  // Deduplicate (keep last amount for same date) and sort
  const deduped: Breakpoint[] = [];
  for (const bp of breakpoints) {
    const last = deduped[deduped.length - 1];
    if (last && last.utc === bp.utc) {
      last.amount = bp.amount;
    } else {
      deduped.push({ ...bp });
    }
  }

  // Build segments
  const segments: ProratedSegment[] = [];
  let runningTotal = 0;

  for (let i = 0; i < deduped.length; i++) {
    const segStart = deduped[i];
    const segEndUtc = i + 1 < deduped.length ? deduped[i + 1].utc : periodEndUtc;
    const segEndDate =
      i + 1 < deduped.length ? deduped[i + 1].date : billingPeriod.end;

    const segDays = Math.round((segEndUtc - segStart.utc) / MS_PER_DAY);
    if (segDays <= 0) continue;

    const dailyRate = segStart.amount / totalDays;
    const segAmount = dailyRate * segDays;
    runningTotal += segAmount;

    segments.push({
      range: { start: segStart.date, end: segEndDate },
      dailyRate,
      days: segDays,
      amount: segAmount,
    });
  }

  return {
    segments,
    totalAmount: runningTotal,
    totalDays,
  };
}

/**
 * Convenience wrapper: prorate a single flat `amount` for a partial period.
 *
 * Equivalent to calling {@link prorateCharge} with `subPeriod === billingPeriod`
 * restricted to `[usageStart, billingPeriod.end)`.
 *
 * @param amount - Full-period charge.
 * @param billingPeriod - The full billing period.
 * @param usageStart - First day the charge applies (defaults to billingPeriod.start).
 */
export function prorateFromDate(
  amount: number,
  billingPeriod: DateRange,
  usageStart: Date = billingPeriod.start
): number {
  return prorateCharge(amount, billingPeriod, {
    start: usageStart,
    end: billingPeriod.end,
  });
}