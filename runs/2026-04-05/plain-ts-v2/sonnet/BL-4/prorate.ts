export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProrateError";
  }
}

export interface Period {
  start: Date;
  end: Date;
}

export interface ProratedSegment {
  start: Date;
  end: Date;
  days: number;
  amount: number;
}

export interface ProrateResult {
  segments: ProratedSegment[];
  totalDays: number;
  totalAmount: number;
}

/**
 * Returns the number of whole days between two dates (start-inclusive, end-exclusive).
 */
export function daysBetween(start: Date, end: Date): number {
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new ProrateError("Invalid start date");
  }
  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new ProrateError("Invalid end date");
  }

  const startMs = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endMs = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  const diffMs = endMs - startMs;
  if (diffMs < 0) {
    throw new ProrateError(
      `start date (${start.toISOString()}) must not be after end date (${end.toISOString()})`
    );
  }

  return Math.round(diffMs / 86_400_000);
}

/**
 * Prorate a total amount proportionally to days used out of total days.
 * Rounds to the nearest cent (2 decimal places).
 */
export function prorateAmount(
  totalAmount: number,
  totalDays: number,
  partialDays: number
): number {
  if (!isFinite(totalAmount)) {
    throw new ProrateError("totalAmount must be a finite number");
  }
  if (!Number.isInteger(totalDays) || totalDays < 0) {
    throw new ProrateError("totalDays must be a non-negative integer");
  }
  if (!Number.isInteger(partialDays) || partialDays < 0) {
    throw new ProrateError("partialDays must be a non-negative integer");
  }
  if (partialDays > totalDays) {
    throw new ProrateError("partialDays cannot exceed totalDays");
  }
  if (totalDays === 0) {
    return 0;
  }

  const raw = (totalAmount * partialDays) / totalDays;
  return Math.round(raw * 100) / 100;
}

/**
 * Split a charge across time segments defined by optional change dates within a billing period.
 *
 * @param totalAmount   - The full charge for the entire billing period.
 * @param billingPeriod - The full billing period (start-inclusive, end-exclusive).
 * @param changeDates   - Zero or more dates inside the billing period that mark plan/rate changes.
 *                        Dates outside the period or equal to the period boundaries are ignored.
 *                        Duplicates are de-duplicated.
 * @returns A ProrateResult with per-segment breakdowns. The last segment's amount is
 *          adjusted by any rounding residual so that segment amounts sum exactly to totalAmount.
 */
export function prorate(
  totalAmount: number,
  billingPeriod: Period,
  changeDates: Date[] = []
): ProrateResult {
  if (!isFinite(totalAmount)) {
    throw new ProrateError("totalAmount must be a finite number");
  }
  if (
    !(billingPeriod.start instanceof Date) ||
    isNaN(billingPeriod.start.getTime())
  ) {
    throw new ProrateError("billingPeriod.start is not a valid Date");
  }
  if (
    !(billingPeriod.end instanceof Date) ||
    isNaN(billingPeriod.end.getTime())
  ) {
    throw new ProrateError("billingPeriod.end is not a valid Date");
  }

  const totalDays = daysBetween(billingPeriod.start, billingPeriod.end);

  if (totalDays === 0) {
    return {
      segments: [],
      totalDays: 0,
      totalAmount,
    };
  }

  // Normalise change dates to midnight UTC day boundaries
  const toUtcDay = (d: Date): number =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  const periodStartMs = toUtcDay(billingPeriod.start);
  const periodEndMs = toUtcDay(billingPeriod.end);

  const splitPointsSet = new Set<number>();
  for (const cd of changeDates) {
    if (!(cd instanceof Date) || isNaN(cd.getTime())) {
      throw new ProrateError(
        `Invalid change date: ${cd}`
      );
    }
    const ms = toUtcDay(cd);
    if (ms > periodStartMs && ms < periodEndMs) {
      splitPointsSet.add(ms);
    }
  }

  // Build sorted boundary list: [start, ...changeDates, end]
  const boundaries: number[] = [
    periodStartMs,
    ...Array.from(splitPointsSet).sort((a, b) => a - b),
    periodEndMs,
  ];

  const segments: ProratedSegment[] = [];
  let allocatedAmount = 0;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStartMs = boundaries[i];
    const segEndMs = boundaries[i + 1];
    const segDays = Math.round((segEndMs - segStartMs) / 86_400_000);

    const isLast = i === boundaries.length - 2;
    let amount: number;

    if (isLast) {
      // Absorb any rounding residual in the last segment
      amount = Math.round((totalAmount - allocatedAmount) * 100) / 100;
    } else {
      amount = prorateAmount(totalAmount, totalDays, segDays);
      allocatedAmount = Math.round((allocatedAmount + amount) * 100) / 100;
    }

    const segStart = new Date(segStartMs);
    const segEnd = new Date(segEndMs);

    segments.push({ start: segStart, end: segEnd, days: segDays, amount });
  }

  return {
    segments,
    totalDays,
    totalAmount,
  };
}