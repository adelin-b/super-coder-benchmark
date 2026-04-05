/**
 * BL-4: Proration Calculator
 * Splits a charge across time periods proportionally.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Period {
  /** Inclusive start of the billing period. */
  start: Date;
  /** Exclusive end of the billing period (first moment that is NOT included). */
  end: Date;
}

export interface ProratedSegment {
  start: Date;
  end: Date;
  /** Number of calendar days in this segment. */
  days: number;
  /** Fraction of the total period this segment represents (0 ≤ fraction ≤ 1). */
  fraction: number;
  /** Prorated amount allocated to this segment, rounded to 2 decimal places. */
  amount: number;
}

export interface ProrationResult {
  /** Original total charge that was split. */
  totalAmount: number;
  /** Total calendar days in the billing period. */
  totalDays: number;
  /** Ordered list of prorated segments (always sums to totalAmount within ±0.01). */
  segments: ProratedSegment[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrationError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the number of whole calendar days between two dates.
 * Uses UTC day arithmetic to avoid DST issues.
 */
export function daysInPeriod(period: Period): number {
  const msPerDay = 86_400_000;
  const diff = period.end.getTime() - period.start.getTime();
  return Math.round(diff / msPerDay);
}

/**
 * Returns the per-day charge for an amount over a period.
 * Throws ProrationError if the period has zero or negative length.
 */
export function dailyRate(amount: number, period: Period): number {
  const days = daysInPeriod(period);
  if (days <= 0) {
    throw new ProrationError(
      `Period must be at least 1 day long (got ${days} days).`
    );
  }
  return amount / days;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Split `amount` across `billingPeriod` using the provided `splitDates`.
 *
 * Rules:
 * - `billingPeriod.start` < `billingPeriod.end` (at least 1 day).
 * - `amount` may be negative (credits).
 * - `splitDates` that fall outside `billingPeriod` are ignored.
 * - Duplicate / boundary split dates are deduplicated.
 * - Rounding remainder is added to the last segment so total is exact.
 *
 * @param amount      Total charge to prorate.
 * @param billingPeriod  The full billing period [start, end).
 * @param splitDates  Dates at which the period should be split.
 * @returns ProrationResult with one segment per sub-period.
 */
export function prorate(
  amount: number,
  billingPeriod: Period,
  splitDates: Date[] = []
): ProrationResult {
  if (!Number.isFinite(amount)) {
    throw new ProrationError(`amount must be a finite number (got ${amount}).`);
  }

  const totalDays = daysInPeriod(billingPeriod); // throws if period invalid

  if (totalDays <= 0) {
    throw new ProrationError(
      `billingPeriod must span at least 1 day (got ${totalDays} days).`
    );
  }

  // Collect boundary timestamps, filtering to inside (start, end) exclusive
  const startTs = billingPeriod.start.getTime();
  const endTs = billingPeriod.end.getTime();

  const boundaries = Array.from(
    new Set(
      splitDates
        .map((d) => d.getTime())
        .filter((ts) => ts > startTs && ts < endTs)
    )
  ).sort((a, b) => a - b);

  // Build ordered list of [segmentStart, segmentEnd) timestamps
  const points = [startTs, ...boundaries, endTs];

  const segments: ProratedSegment[] = [];
  let allocatedCents = 0;
  const totalCents = Math.round(amount * 100);

  for (let i = 0; i < points.length - 1; i++) {
    const segStart = new Date(points[i]);
    const segEnd = new Date(points[i + 1]);
    const days = Math.round((points[i + 1] - points[i]) / 86_400_000);
    const fraction = days / totalDays;

    const isLast = i === points.length - 2;
    let segmentCents: number;

    if (isLast) {
      // Absorb rounding remainder in the final segment
      segmentCents = totalCents - allocatedCents;
    } else {
      segmentCents = Math.round(fraction * totalCents);
      allocatedCents += segmentCents;
    }

    segments.push({
      start: segStart,
      end: segEnd,
      days,
      fraction: Number(fraction.toFixed(10)),
      amount: segmentCents / 100,
    });
  }

  return {
    totalAmount: amount,
    totalDays,
    segments,
  };
}

/**
 * Convenience wrapper for the common case of a single mid-period change.
 *
 * @param amount         Total charge for the full billing period.
 * @param billingPeriod  The full billing period.
 * @param changeDate     Date at which something changed mid-period.
 * @returns Tuple [beforeChange, afterChange] of ProratedSegment.
 */
export function prorateAtChange(
  amount: number,
  billingPeriod: Period,
  changeDate: Date
): [ProratedSegment, ProratedSegment] {
  const result = prorate(amount, billingPeriod, [changeDate]);

  if (result.segments.length !== 2) {
    throw new ProrationError(
      `changeDate must fall strictly inside the billing period.`
    );
  }

  return [result.segments[0], result.segments[1]];
}

/**
 * Calculates the prorated amount for a partial period without a full split.
 *
 * Useful when a subscription starts or ends mid-period.
 *
 * @param fullPeriodAmount  Amount that would be charged for the full period.
 * @param fullPeriod        The full billing period.
 * @param activePeriod      The sub-period the customer was actually active.
 * @returns Prorated amount for the active sub-period.
 */
export function proratePartialPeriod(
  fullPeriodAmount: number,
  fullPeriod: Period,
  activePeriod: Period
): number {
  if (!Number.isFinite(fullPeriodAmount)) {
    throw new ProrationError(
      `fullPeriodAmount must be a finite number (got ${fullPeriodAmount}).`
    );
  }

  const totalDays = daysInPeriod(fullPeriod);
  if (totalDays <= 0) {
    throw new ProrationError(
      `fullPeriod must span at least 1 day (got ${totalDays} days).`
    );
  }

  const activeDays = daysInPeriod(activePeriod);
  if (activeDays < 0) {
    throw new ProrationError(
      `activePeriod end must be >= start (got ${activeDays} days).`
    );
  }
  if (activeDays === 0) {
    return 0;
  }

  if (
    activePeriod.start.getTime() < fullPeriod.start.getTime() ||
    activePeriod.end.getTime() > fullPeriod.end.getTime()
  ) {
    throw new ProrationError(
      "activePeriod must be contained within fullPeriod."
    );
  }

  const fraction = activeDays / totalDays;
  return Math.round(fullPeriodAmount * fraction * 100) / 100;
}