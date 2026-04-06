import { Effect, Data, pipe } from "effect";

/**
 * Error types for proration calculations
 */
class InvalidDateRange extends Data.TaggedError("InvalidDateRange")<{
  reason: string;
}> {}

class InvalidChargeAmount extends Data.TaggedError("InvalidChargeAmount")<{
  reason: string;
}> {}

/**
 * Input for proration calculation
 */
export interface ProrateInput {
  /** Total charge for the full period */
  chargeAmount: number;
  /** Start of the billing period */
  periodStart: Date;
  /** End of the billing period */
  periodEnd: Date;
  /** Start of actual usage/service within the period */
  usageStart: Date;
  /** End of actual usage/service within the period */
  usageEnd: Date;
}

/**
 * Result of proration calculation
 */
export interface ProrateResult {
  /** Prorated charge amount */
  amount: number;
  /** Number of days actually used */
  daysUsed: number;
  /** Total days in the billing period */
  totalDays: number;
  /** Percentage of period used (0-1) */
  percentage: number;
}

/**
 * Calculate days between two dates (inclusive of start, exclusive of end)
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
}

/**
 * Internal Effect-based proration logic with validation
 */
function prorateEffect(input: ProrateInput): Effect.Effect<ProrateResult, InvalidDateRange | InvalidChargeAmount> {
  return Effect.gen(function* () {
    const {
      chargeAmount,
      periodStart,
      periodEnd,
      usageStart,
      usageEnd,
    } = input;

    // Validate charge amount
    if (chargeAmount < 0) {
      yield* Effect.fail(
        new InvalidChargeAmount({ reason: "chargeAmount must be non-negative" })
      );
    }

    // Validate period dates
    if (periodStart.getTime() >= periodEnd.getTime()) {
      yield* Effect.fail(
        new InvalidDateRange({
          reason: "periodStart must be before periodEnd",
        })
      );
    }

    // Validate usage dates
    if (usageStart.getTime() >= usageEnd.getTime()) {
      yield* Effect.fail(
        new InvalidDateRange({
          reason: "usageStart must be before usageEnd",
        })
      );
    }

    // Calculate overlap between period and usage
    const overlapStart = new Date(
      Math.max(periodStart.getTime(), usageStart.getTime())
    );
    const overlapEnd = new Date(
      Math.min(periodEnd.getTime(), usageEnd.getTime())
    );

    // If no overlap, return zero charge
    if (overlapStart.getTime() >= overlapEnd.getTime()) {
      return {
        amount: 0,
        daysUsed: 0,
        totalDays: daysBetween(periodStart, periodEnd),
        percentage: 0,
      };
    }

    const totalDays = daysBetween(periodStart, periodEnd);
    const daysUsed = daysBetween(overlapStart, overlapEnd);

    if (totalDays === 0) {
      yield* Effect.fail(
        new InvalidDateRange({
          reason: "billing period must span at least one day",
        })
      );
    }

    const percentage = daysUsed / totalDays;
    const amount = chargeAmount * percentage;

    return {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      daysUsed,
      totalDays,
      percentage,
    };
  });
}

/**
 * Calculate prorated charge for partial period usage
 * @param input - Proration input with dates and charge amount
 * @returns Prorated charge result
 * @throws ValidationError for invalid inputs
 */
export function prorate(input: ProrateInput): ProrateResult {
  return Effect.runSync(prorateEffect(input));
}

/**
 * Calculate proration for a usage window, validating inputs
 * @param chargeAmount - Total charge for the full period
 * @param periodStart - Billing period start
 * @param periodEnd - Billing period end
 * @param usageStart - Service usage start
 * @param usageEnd - Service usage end
 * @returns Prorated charge result
 * @throws ValidationError for invalid inputs
 */
export function prorateCharge(
  chargeAmount: number,
  periodStart: Date,
  periodEnd: Date,
  usageStart: Date,
  usageEnd: Date
): ProrateResult {
  return prorate({
    chargeAmount,
    periodStart,
    periodEnd,
    usageStart,
    usageEnd,
  });
}

/**
 * Calculate refund for unused portion of a period
 * @param chargeAmount - Total charge for the full period
 * @param periodStart - Billing period start
 * @param periodEnd - Billing period end
 * @param cancelDate - Date service was cancelled
 * @returns Refund amount (negative value represents credit back to customer)
 * @throws ValidationError for invalid inputs
 */
export function calculateRefund(
  chargeAmount: number,
  periodStart: Date,
  periodEnd: Date,
  cancelDate: Date
): number {
  // Calculate what was used (from start to cancel date)
  const used = prorate({
    chargeAmount,
    periodStart,
    periodEnd,
    usageStart: periodStart,
    usageEnd: cancelDate,
  });

  // Refund is the difference
  return Math.round((chargeAmount - used.amount) * 100) / 100;
}

/**
 * Calculate credit for overlapping billing periods (e.g., when switching plans)
 * @param fromCharge - Charge for the old plan
 * @param toCharge - Charge for the new plan
 * @param periodStart - Billing period start
 * @param periodEnd - Billing period end
 * @param switchDate - Date of plan change
 * @returns Credit/debit amount (positive = customer pays more, negative = customer gets credit)
 * @throws ValidationError for invalid inputs
 */
export function calculatePlanChangeCredit(
  fromCharge: number,
  toCharge: number,
  periodStart: Date,
  periodEnd: Date,
  switchDate: Date
): number {
  // Charge for old plan (period start to switch)
  const oldPlanCharge = prorate({
    chargeAmount: fromCharge,
    periodStart,
    periodEnd,
    usageStart: periodStart,
    usageEnd: switchDate,
  });

  // Charge for new plan (switch to period end)
  const newPlanCharge = prorate({
    chargeAmount: toCharge,
    periodStart,
    periodEnd,
    usageStart: switchDate,
    usageEnd: periodEnd,
  });

  // Net charge difference (total new - total old)
  const total = oldPlanCharge.amount + newPlanCharge.amount;
  const difference = total - (fromCharge + toCharge) / 2; // Compare to average

  return Math.round(difference * 100) / 100;
}