import { Effect, Exit, Cause, Data } from "effect";

interface PeriodCharge {
  startDate: Date;
  endDate: Date;
  charge: number;
}

class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
  message: string;
}> {}

function prorateInternal(
  totalCharge: number,
  startDate: Date,
  endDate: Date,
  decimals: number = 2
): Effect.Effect<PeriodCharge[], InvalidInputError> {
  return Effect.gen(function* () {
    if (totalCharge < 0) {
      yield* Effect.fail(
        new InvalidInputError({ message: "Charge cannot be negative" })
      );
    }
    if (startDate >= endDate) {
      yield* Effect.fail(
        new InvalidInputError({
          message: "Start date must be before end date",
        })
      );
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / msPerDay
    );

    if (totalDays <= 0) {
      yield* Effect.fail(
        new InvalidInputError({
          message: "Date range must span at least one day",
        })
      );
    }

    const dailyRate = totalCharge / totalDays;
    const multiplier = Math.pow(10, decimals);

    const result: PeriodCharge[] = [];
    let currentDate = new Date(startDate);
    let remainingCharge = totalCharge;

    while (currentDate < endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const periodEnd =
        nextDate > endDate ? new Date(endDate) : nextDate;
      const periodDays =
        (periodEnd.getTime() - currentDate.getTime()) / msPerDay;

      let charge = dailyRate * periodDays;
      charge = Math.round(charge * multiplier) / multiplier;

      if (periodEnd >= endDate) {
        charge = Math.max(0, remainingCharge);
      }

      result.push({
        startDate: new Date(currentDate),
        endDate: new Date(periodEnd),
        charge,
      });

      remainingCharge -= charge;
      currentDate = new Date(periodEnd);
    }

    return result;
  });
}

export function prorate(
  totalCharge: number,
  startDate: Date,
  endDate: Date,
  decimals: number = 2
): PeriodCharge[] {
  const exit = Effect.runSyncExit(
    prorateInternal(totalCharge, startDate, endDate, decimals)
  );
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
}

export function prorateDaily(
  totalCharge: number,
  daysUsed: number,
  daysInPeriod: number
): number {
  const exit = Effect.runSyncExit(
    Effect.gen(function* () {
      if (daysUsed < 0) {
        yield* Effect.fail(
          new InvalidInputError({
            message: "Days used cannot be negative",
          })
        );
      }
      if (daysInPeriod <= 0) {
        yield* Effect.fail(
          new InvalidInputError({
            message: "Days in period must be positive",
          })
        );
      }
      if (daysUsed > daysInPeriod) {
        yield* Effect.fail(
          new InvalidInputError({
            message: "Days used cannot exceed days in period",
          })
        );
      }

      const prorated = (totalCharge * daysUsed) / daysInPeriod;
      return Math.round(prorated * 100) / 100;
    })
  );
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
}