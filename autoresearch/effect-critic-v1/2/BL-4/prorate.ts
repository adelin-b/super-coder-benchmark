import { Effect, Data, pipe } from "effect";

export class ProrateError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProrateError";
  }
}

interface ProrateInput {
  totalAmount: number;
  startDate: string;
  endDate: string;
  billingStart: string;
  billingEnd: string;
}

export interface ProrateResult {
  proratedAmount: number;
  ratio: number;
  daysUsed: number;
}

function calculateProrateInternal(input: ProrateInput): Effect.Effect<ProrateResult, ProrateError> {
  return Effect.gen(function* () {
    const { totalAmount, startDate, endDate, billingStart, billingEnd } = input;

    // Validate totalAmount
    if (totalAmount < 0) {
      yield* Effect.fail(new ProrateError("totalAmount cannot be negative"));
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const billStart = new Date(billingStart);
    const billEnd = new Date(billingEnd);

    // Validate billing range
    if (billStart > billEnd) {
      yield* Effect.fail(new ProrateError("billingStart must be <= billingEnd"));
    }

    // Calculate intersection of [start, end] with [billStart, billEnd]
    const actualStart = new Date(Math.max(start.getTime(), billStart.getTime()));
    const actualEnd = new Date(Math.min(end.getTime(), billEnd.getTime()));

    // Helper function to calculate days between two dates
    const daysBetween = (d1: Date, d2: Date): number => {
      return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Calculate days used and total days
    const daysUsed = Math.max(0, daysBetween(actualStart, actualEnd));
    const totalDays = daysBetween(billStart, billEnd);

    // Calculate ratio and prorated amount
    const ratio = totalDays === 0 ? 0 : daysUsed / totalDays;
    const proratedAmount = totalAmount * ratio;

    return {
      proratedAmount,
      ratio,
      daysUsed,
    };
  });
}

export function calculateProration(input: ProrateInput): ProrateResult {
  try {
    return Effect.runSync(calculateProrateInternal(input));
  } catch (e: unknown) {
    if (e instanceof ProrateError) {
      throw e;
    }
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}