import { Effect, Data } from "effect";

class InvalidBillingRange extends Data.TaggedError(
  "InvalidBillingRange"
)<{ message: string }> {}

class InvalidServicePeriod extends Data.TaggedError(
  "InvalidServicePeriod"
)<{ message: string }> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  message: string;
}> {}

function calculateProrateEffect(params: {
  periodStart: Date;
  periodEnd: Date;
  serviceStart: Date;
  serviceEnd?: Date;
  amount: number;
}): Effect.Effect<
  number,
  InvalidBillingRange | InvalidServicePeriod | InvalidAmount
> {
  return Effect.gen(function* () {
    if (!params || !params.periodStart || !params.periodEnd) {
      yield* Effect.fail(
        new InvalidBillingRange({ message: "Missing period dates" })
      );
    }

    if (!params.serviceStart) {
      yield* Effect.fail(
        new InvalidServicePeriod({ message: "Missing service start date" })
      );
    }

    const periodStart = params.periodStart.getTime();
    const periodEnd = params.periodEnd.getTime();
    const serviceStart = params.serviceStart.getTime();
    const serviceEnd = params.serviceEnd
      ? params.serviceEnd.getTime()
      : periodEnd;

    if (periodStart >= periodEnd) {
      yield* Effect.fail(
        new InvalidBillingRange({
          message: "Period start must be before period end",
        })
      );
    }

    if (params.amount < 0) {
      yield* Effect.fail(
        new InvalidAmount({ message: "Amount must be non-negative" })
      );
    }

    // Calculate overlap between service period and billing period
    const overlapStart = Math.max(periodStart, serviceStart);
    const overlapEnd = Math.min(periodEnd, serviceEnd);

    // If no overlap, charge is 0
    if (overlapStart >= overlapEnd) {
      return 0;
    }

    // Calculate the fraction of the billing period that was active
    const overlapMs = overlapEnd - overlapStart;
    const totalMs = periodEnd - periodStart;

    const proratedAmount = (overlapMs / totalMs) * params.amount;

    // Round to 2 decimal places for monetary values
    return Math.round(proratedAmount * 100) / 100;
  });
}

export function calculateProration(params: {
  periodStart: Date;
  periodEnd: Date;
  serviceStart: Date;
  serviceEnd?: Date;
  amount: number;
}): number {
  if (!params || !params.periodStart || !params.periodEnd) {
    throw new Error("Missing period dates");
  }

  if (!params.serviceStart) {
    throw new Error("Missing service start date");
  }

  const periodStart = params.periodStart.getTime();
  const periodEnd = params.periodEnd.getTime();
  const serviceStart = params.serviceStart.getTime();
  const serviceEnd = params.serviceEnd
    ? params.serviceEnd.getTime()
    : periodEnd;

  if (periodStart >= periodEnd) {
    throw new Error("Period start must be before period end");
  }

  if (params.amount < 0) {
    throw new Error("Amount must be non-negative");
  }

  // Calculate overlap between service period and billing period
  const overlapStart = Math.max(periodStart, serviceStart);
  const overlapEnd = Math.min(periodEnd, serviceEnd);

  // If no overlap, charge is 0
  if (overlapStart >= overlapEnd) {
    return 0;
  }

  // Calculate the fraction of the billing period that was active
  const overlapMs = overlapEnd - overlapStart;
  const totalMs = periodEnd - periodStart;

  const proratedAmount = (overlapMs / totalMs) * params.amount;

  // Round to 2 decimal places for monetary values
  return Math.round(proratedAmount * 100) / 100;
}