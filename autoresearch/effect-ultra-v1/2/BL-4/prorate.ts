import { Effect, pipe, Data } from "effect";

class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
  message: string;
}> {}

function calculateProrationType(
  amount: number,
  startDate: string,
  endDate: string,
  billingPeriodStart: string,
  billingPeriodEnd: string
): Effect.Effect<{ proratedAmount: number; ratio: number }, InvalidInputError> {
  return Effect.gen(function* () {
    // Validate amount
    if (amount < 0) {
      yield* Effect.fail(
        new InvalidInputError({ message: "Amount must be non-negative" })
      );
    }

    // Parse dates as UTC to avoid timezone drift
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    const periodStart = new Date(billingPeriodStart + "T00:00:00Z");
    const periodEnd = new Date(billingPeriodEnd + "T00:00:00Z");

    // Validate date ranges
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      yield* Effect.fail(
        new InvalidInputError({ message: "Invalid service date format" })
      );
    }

    if (
      isNaN(periodStart.getTime()) ||
      isNaN(periodEnd.getTime())
    ) {
      yield* Effect.fail(
        new InvalidInputError({
          message: "Invalid billing period date format",
        })
      );
    }

    if (start >= end) {
      yield* Effect.fail(
        new InvalidInputError({
          message: "Service start date must be before end date",
        })
      );
    }

    if (periodStart >= periodEnd) {
      yield* Effect.fail(
        new InvalidInputError({
          message: "Billing period start must be before end date",
        })
      );
    }

    // Calculate service period in milliseconds
    const serviceDurationMs = end.getTime() - start.getTime();
    const billingDurationMs = periodEnd.getTime() - periodStart.getTime();

    // Calculate ratio, clamped to [0, 1]
    let ratio = serviceDurationMs / billingDurationMs;
    ratio = Math.max(0, Math.min(1, ratio));

    // Calculate prorated amount, rounded to 2 decimal places
    const proratedAmount = Math.round(amount * ratio * 100) / 100;

    return { proratedAmount, ratio };
  });
}

export function calculateProration(
  amount: number,
  startDate: string,
  endDate: string,
  billingPeriodStart: string,
  billingPeriodEnd: string
): { proratedAmount: number; ratio: number } {
  // Boundary validation before Effect
  if (amount < 0) {
    throw new Error("Amount must be non-negative");
  }

  try {
    return Effect.runSync(
      calculateProrationType(amount, startDate, endDate, billingPeriodStart, billingPeriodEnd)
    );
  } catch (e: unknown) {
    // Re-throw plain Error, never let FiberFailure escape
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}