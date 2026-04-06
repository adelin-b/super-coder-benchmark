import { Effect, Data, pipe } from "effect";

class InvalidInput extends Data.TaggedError("InvalidInput")<{
  reason: string;
}> {}

class DateRangeError extends Data.TaggedError("DateRangeError")<{
  reason: string;
}> {}

/**
 * Calculates the number of days between two dates (inclusive of start, exclusive of end).
 */
function calculateDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Internal Effect-based validation and calculation.
 */
function prorateEffect(
  totalCharge: number,
  periodStart: Date,
  periodEnd: Date,
  prorateStart: Date,
  prorateEnd?: Date
): Effect.Effect<number, InvalidInput | DateRangeError> {
  return Effect.gen(function* () {
    // Validate charge
    if (totalCharge < 0) {
      yield* Effect.fail(
        new InvalidInput({ reason: "totalCharge cannot be negative" })
      );
    }

    // Validate period dates
    if (periodStart.getTime() >= periodEnd.getTime()) {
      yield* Effect.fail(
        new DateRangeError({
          reason: "periodStart must be before periodEnd",
        })
      );
    }

    // Validate prorate start is within period
    if (
      prorateStart.getTime() < periodStart.getTime() ||
      prorateStart.getTime() > periodEnd.getTime()
    ) {
      yield* Effect.fail(
        new DateRangeError({
          reason: "prorateStart must be within the billing period",
        })
      );
    }

    // Validate prorate end
    const end = prorateEnd || periodEnd;
    if (
      end.getTime() < prorateStart.getTime() ||
      end.getTime() > periodEnd.getTime()
    ) {
      yield* Effect.fail(
        new DateRangeError({
          reason: "prorateEnd must be within the period and after prorateStart",
        })
      );
    }

    // Calculate days
    const fullPeriodDays = calculateDaysBetween(periodStart, periodEnd);
    const proratedDays = calculateDaysBetween(prorateStart, end);

    if (fullPeriodDays === 0) {
      yield* Effect.fail(
        new InvalidInput({ reason: "billing period must span at least one day" })
      );
    }

    // Calculate daily rate and prorated amount
    const dailyRate = totalCharge / fullPeriodDays;
    const proratedAmount = dailyRate * proratedDays;

    return proratedAmount;
  });
}

/**
 * Calculates the prorated charge for a partial billing period.
 *
 * @param totalCharge - The full charge for the entire billing period
 * @param periodStart - The start date of the billing period
 * @param periodEnd - The end date of the billing period
 * @param prorateStart - The start date of the proration (when new rate begins)
 * @param prorateEnd - The end date of the proration (defaults to periodEnd)
 * @returns The prorated charge amount
 * @throws Error if inputs are invalid
 *
 * @example
 * // Monthly billing: $100 for April 1-30, upgraded on April 15
 * const prorated = calculateProration(
 *   100,
 *   new Date("2024-04-01"),
 *   new Date("2024-05-01"),
 *   new Date("2024-04-15")
 * );
 * // Returns ~50 (half the month)
 */
export function calculateProration(
  totalCharge: number,
  periodStart: Date,
  periodEnd: Date,
  prorateStart: Date,
  prorateEnd?: Date
): number {
  try {
    return Effect.runSync(
      prorateEffect(totalCharge, periodStart, periodEnd, prorateStart, prorateEnd)
    );
  } catch (e) {
    if (e instanceof Error && "reason" in e && typeof e.reason === "string") {
      throw new Error(e.reason as string);
    }
    throw e;
  }
}

/**
 * Calculates the daily rate for a billing period.
 *
 * @param totalCharge - The total charge for the period
 * @param periodStart - The start date of the period
 * @param periodEnd - The end date of the period
 * @returns The daily charge rate
 * @throws Error if inputs are invalid
 *
 * @example
 * // $100 for 30 days = $3.33 per day
 * const rate = calculateDailyRate(
 *   100,
 *   new Date("2024-04-01"),
 *   new Date("2024-05-01")
 * );
 */
export function calculateDailyRate(
  totalCharge: number,
  periodStart: Date,
  periodEnd: Date
): number {
  const dailyRateEffect = Effect.gen(function* () {
    if (totalCharge < 0) {
      yield* Effect.fail(
        new InvalidInput({ reason: "totalCharge cannot be negative" })
      );
    }

    if (periodStart.getTime() >= periodEnd.getTime()) {
      yield* Effect.fail(
        new DateRangeError({
          reason: "periodStart must be before periodEnd",
        })
      );
    }

    const fullPeriodDays = calculateDaysBetween(periodStart, periodEnd);

    if (fullPeriodDays === 0) {
      yield* Effect.fail(
        new InvalidInput({ reason: "period must span at least one day" })
      );
    }

    return totalCharge / fullPeriodDays;
  });

  try {
    return Effect.runSync(dailyRateEffect);
  } catch (e) {
    if (e instanceof Error && "reason" in e && typeof e.reason === "string") {
      throw new Error(e.reason as string);
    }
    throw e;
  }
}

/**
 * Calculates a refund for a partial billing period (inverse of proration).
 *
 * @param totalCharge - The full charge for the entire billing period
 * @param periodStart - The start date of the billing period
 * @param periodEnd - The end date of the billing period
 * @param refundStart - The start date of the refund period
 * @param refundEnd - The end date of the refund period (defaults to periodEnd)
 * @returns The refund amount
 * @throws Error if inputs are invalid
 *
 * @example
 * // Monthly billing: $100 for April 1-30, downgraded on April 15
 * // Refund for April 15-30
 * const refund = calculateRefund(
 *   100,
 *   new Date("2024-04-01"),
 *   new Date("2024-05-01"),
 *   new Date("2024-04-15")
 * );
 * // Returns ~50 (refund for half the month)
 */
export function calculateRefund(
  totalCharge: number,
  periodStart: Date,
  periodEnd: Date,
  refundStart: Date,
  refundEnd?: Date
): number {
  return calculateProration(
    totalCharge,
    periodStart,
    periodEnd,
    refundStart,
    refundEnd
  );
}