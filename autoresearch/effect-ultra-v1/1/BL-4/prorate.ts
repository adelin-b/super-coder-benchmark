import { Effect, Data } from "effect";

// Internal error types
class InvalidProrationInput extends Data.TaggedError("InvalidProrationInput")<{
  reason: string;
}> {}

class InvalidDateRange extends Data.TaggedError("InvalidDateRange")<{
  reason: string;
}> {}

// Internal: Effect-based validation
function validateAmount(amount: number): Effect.Effect<number, InvalidProrationInput> {
  return amount < 0
    ? Effect.fail(new InvalidProrationInput({ reason: "amount must be non-negative" }))
    : Effect.succeed(amount);
}

function validateDays(
  daysUsed: number,
  totalDays: number
): Effect.Effect<{ daysUsed: number; totalDays: number }, InvalidProrationInput> {
  return Effect.gen(function* () {
    if (daysUsed < 0) {
      yield* Effect.fail(new InvalidProrationInput({ reason: "daysUsed must be non-negative" }));
    }
    if (totalDays <= 0) {
      yield* Effect.fail(new InvalidProrationInput({ reason: "totalDays must be positive" }));
    }
    return { daysUsed, totalDays };
  });
}

function validateDateRange(
  startDate: Date,
  endDate: Date
): Effect.Effect<{ startDate: Date; endDate: Date }, InvalidDateRange> {
  return Effect.gen(function* () {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      yield* Effect.fail(new InvalidDateRange({ reason: "dates must be valid Date objects" }));
    }
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      yield* Effect.fail(new InvalidDateRange({ reason: "dates must be valid" }));
    }
    if (startDate > endDate) {
      yield* Effect.fail(new InvalidDateRange({ reason: "startDate must be before endDate" }));
    }
    return { startDate, endDate };
  });
}

// Internal: calculate days between two dates (inclusive of start, exclusive of end)
function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
}

// Exported: Calculate prorated amount based on days used
export function calculateProration(
  fullAmount: number,
  daysUsed: number,
  totalDays: number
): { proratedAmount: number; ratio: number } {
  if (fullAmount < 0) throw new Error("amount must be non-negative");
  if (daysUsed < 0) throw new Error("daysUsed must be non-negative");
  if (totalDays <= 0) throw new Error("totalDays must be positive");

  // Clamp ratio to [0, 1]
  const ratio = Math.min(daysUsed / totalDays, 1);
  const proratedAmount = Math.round(fullAmount * ratio * 100) / 100; // Round to 2 decimals

  return { proratedAmount, ratio };
}

// Exported: Calculate prorated price between two dates
export function calculateProratedPrice(
  fullAmount: number,
  startDate: Date,
  endDate: Date,
  periodDays: number
): number {
  if (fullAmount < 0) throw new Error("amount must be non-negative");
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error("dates must be valid Date objects");
  }
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("dates must be valid");
  }
  if (startDate > endDate) throw new Error("startDate must be before endDate");
  if (periodDays <= 0) throw new Error("periodDays must be positive");

  const daysUsed = calculateDaysBetween(startDate, endDate);
  const { proratedAmount } = calculateProration(fullAmount, daysUsed, periodDays);
  return proratedAmount;
}

// Exported: Calculate refund for early termination
export function calculateRefund(
  fullAmount: number,
  periodStart: Date,
  periodEnd: Date,
  usageEnd: Date
): number {
  if (fullAmount < 0) throw new Error("amount must be non-negative");
  if (!(periodStart instanceof Date) || !(periodEnd instanceof Date) || !(usageEnd instanceof Date)) {
    throw new Error("dates must be valid Date objects");
  }
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()) || isNaN(usageEnd.getTime())) {
    throw new Error("dates must be valid");
  }
  if (periodStart > periodEnd) throw new Error("periodStart must be before periodEnd");
  if (usageEnd < periodStart || usageEnd > periodEnd) {
    throw new Error("usageEnd must be within the period");
  }

  const totalDays = calculateDaysBetween(periodStart, periodEnd);
  const usedDays = calculateDaysBetween(periodStart, usageEnd);
  const unusedDays = totalDays - usedDays;

  const { proratedAmount } = calculateProration(fullAmount, unusedDays, totalDays);
  return proratedAmount;
}

// Exported: Calculate prorated amount for upgrade/downgrade
export function calculateProrationDifference(
  oldAmount: number,
  newAmount: number,
  daysRemaining: number,
  totalDays: number
): number {
  if (oldAmount < 0 || newAmount < 0) throw new Error("amounts must be non-negative");
  if (daysRemaining < 0) throw new Error("daysRemaining must be non-negative");
  if (totalDays <= 0) throw new Error("totalDays must be positive");

  const daysUsed = totalDays - daysRemaining;
  const { proratedAmount: oldProratedUsed } = calculateProration(oldAmount, daysUsed, totalDays);
  const { proratedAmount: newProratedUsed } = calculateProration(newAmount, daysUsed, totalDays);

  // Difference is what the customer owes or is refunded
  return Math.round((newProratedUsed - oldProratedUsed) * 100) / 100;
}