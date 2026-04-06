import { Effect, Data, pipe } from "effect";

class InvalidInput extends Data.TaggedError("InvalidInput")<{
  reason: string;
}> {}

interface ProrationResult {
  amount: number;
  days: number;
  rate: number;
}

interface SplitProrationResult {
  before: ProrationResult;
  after: ProrationResult;
}

/**
 * Calculate the number of days between two dates (inclusive of start, exclusive of end).
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86400000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Validate and create prorations.
 */
function validateProrateInputEffect(
  periodStart: Date,
  periodEnd: Date,
  chargeAmount: number
): Effect.Effect<{ start: Date; end: Date; charge: number }, InvalidInput> {
  return Effect.sync(() => {
    if (!(periodStart instanceof Date) || isNaN(periodStart.getTime())) {
      throw new InvalidInput({ reason: "periodStart must be a valid Date" });
    }
    if (!(periodEnd instanceof Date) || isNaN(periodEnd.getTime())) {
      throw new InvalidInput({ reason: "periodEnd must be a valid Date" });
    }
    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw new InvalidInput({
        reason: "periodStart must be before periodEnd",
      });
    }
    if (typeof chargeAmount !== "number" || chargeAmount < 0) {
      throw new InvalidInput({
        reason: "chargeAmount must be a non-negative number",
      });
    }
    return { start: periodStart, end: periodEnd, charge: chargeAmount };
  }).pipe(
    Effect.catchAll((e) => {
      if (e instanceof InvalidInput) return Effect.fail(e);
      return Effect.fail(
        new InvalidInput({ reason: `Unexpected error: ${String(e)}` })
      );
    })
  );
}

/**
 * Calculate prorated charge for a period given a daily rate.
 */
function calculateDailyProrateEffect(
  startDate: Date,
  endDate: Date,
  dailyRate: number
): Effect.Effect<number, InvalidInput> {
  return Effect.gen(function* () {
    yield* validateProrateInputEffect(startDate, endDate, dailyRate);
    const days = daysBetween(startDate, endDate);
    if (days <= 0) {
      yield* Effect.fail(
        new InvalidInput({ reason: "Period must span at least 1 day" })
      );
    }
    const amount = days * dailyRate;
    return Math.round(amount * 100) / 100;
  });
}

/**
 * Split a billing period charge at a specific change date.
 * Returns the prorated amounts before and after the change date.
 */
function splitBillingPeriodEffect(
  periodStart: Date,
  periodEnd: Date,
  chargeAmount: number,
  changeDate: Date
): Effect.Effect<SplitProrationResult, InvalidInput> {
  return Effect.gen(function* () {
    yield* validateProrateInputEffect(periodStart, periodEnd, chargeAmount);
    
    if (!(changeDate instanceof Date) || isNaN(changeDate.getTime())) {
      yield* Effect.fail(
        new InvalidInput({ reason: "changeDate must be a valid Date" })
      );
    }
    
    const changeTime = changeDate.getTime();
    const startTime = periodStart.getTime();
    const endTime = periodEnd.getTime();
    
    if (changeTime <= startTime || changeTime >= endTime) {
      yield* Effect.fail(
        new InvalidInput({
          reason: "changeDate must be strictly between periodStart and periodEnd",
        })
      );
    }
    
    const totalDays = daysBetween(periodStart, periodEnd);
    const daysBeforeChange = daysBetween(periodStart, changeDate);
    const daysAfterChange = totalDays - daysBeforeChange;
    
    const dailyRate = chargeAmount / totalDays;
    
    const beforeAmount = Math.round(daysBeforeChange * dailyRate * 100) / 100;
    const afterAmount = Math.round(daysAfterChange * dailyRate * 100) / 100;
    
    return {
      before: {
        amount: beforeAmount,
        days: daysBeforeChange,
        rate: Math.round(dailyRate * 100) / 100,
      },
      after: {
        amount: afterAmount,
        days: daysAfterChange,
        rate: Math.round(dailyRate * 100) / 100,
      },
    };
  });
}

/**
 * Calculate prorated charge for a partial period at the end of a billing month.
 * Used when a subscription starts mid-month.
 */
function calculateProration(
  periodStart: Date,
  periodEnd: Date,
  monthlyCharge: number
): ProrationResult {
  if (
    !(periodStart instanceof Date) ||
    isNaN(periodStart.getTime())
  ) {
    throw new Error("periodStart must be a valid Date");
  }
  if (
    !(periodEnd instanceof Date) ||
    isNaN(periodEnd.getTime())
  ) {
    throw new Error("periodEnd must be a valid Date");
  }
  if (periodStart.getTime() >= periodEnd.getTime()) {
    throw new Error("periodStart must be before periodEnd");
  }
  if (typeof monthlyCharge !== "number" || monthlyCharge < 0) {
    throw new Error("monthlyCharge must be a non-negative number");
  }

  const result = Effect.runSync(
    calculateDailyProrateEffect(periodStart, periodEnd, monthlyCharge / 30)
  );

  const days = daysBetween(periodStart, periodEnd);
  const dailyRate = monthlyCharge / 30;

  return {
    amount: result,
    days,
    rate: Math.round(dailyRate * 100) / 100,
  };
}

/**
 * Split a billing period charge at a change date, returning amounts before and after.
 * Used when a price or plan changes mid-billing-period.
 */
function splitAtDate(
  periodStart: Date,
  periodEnd: Date,
  chargeAmount: number,
  changeDate: Date
): SplitProrationResult {
  if (
    !(periodStart instanceof Date) ||
    isNaN(periodStart.getTime())
  ) {
    throw new Error("periodStart must be a valid Date");
  }
  if (
    !(periodEnd instanceof Date) ||
    isNaN(periodEnd.getTime())
  ) {
    throw new Error("periodEnd must be a valid Date");
  }
  if (periodStart.getTime() >= periodEnd.getTime()) {
    throw new Error("periodStart must be before periodEnd");
  }
  if (typeof chargeAmount !== "number" || chargeAmount < 0) {
    throw new Error("chargeAmount must be a non-negative number");
  }
  if (
    !(changeDate instanceof Date) ||
    isNaN(changeDate.getTime())
  ) {
    throw new Error("changeDate must be a valid Date");
  }

  return Effect.runSync(
    splitBillingPeriodEffect(periodStart, periodEnd, chargeAmount, changeDate)
  );
}

/**
 * Calculate a daily rate from a monthly charge.
 */
function getDailyRate(monthlyCharge: number): number {
  if (typeof monthlyCharge !== "number" || monthlyCharge < 0) {
    throw new Error("monthlyCharge must be a non-negative number");
  }
  return Math.round((monthlyCharge / 30) * 100) / 100;
}

export {
  calculateProration,
  splitAtDate,
  getDailyRate,
  ProrationResult,
  SplitProrationResult,
};