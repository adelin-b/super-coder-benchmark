import { Effect, Exit, Cause, Data } from "effect";

export interface ProrationInput {
  totalAmount: number;
  startDate: string;
  endDate: string;
  billingStart: string;
  billingEnd: string;
}

export interface ProrationResult {
  proratedAmount: number;
  daysUsed: number;
  totalDays: number;
  ratio: number;
}

export class ProrateError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "ProrateError";
  }
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function calculateProrateInternal(
  input: ProrationInput
): Effect.Effect<ProrationResult, ProrateError> {
  return Effect.gen(function* () {
    const { totalAmount, startDate, endDate, billingStart, billingEnd } =
      input;

    if (totalAmount < 0) {
      yield* Effect.fail(
        new ProrateError("totalAmount must be non-negative")
      );
    }

    const totalDays = daysBetween(billingStart, billingEnd);
    if (totalDays <= 0) {
      yield* Effect.fail(
        new ProrateError("billingEnd must be after billingStart")
      );
    }

    const effectiveStart =
      startDate < billingStart ? billingStart : startDate;
    const effectiveEnd = endDate > billingEnd ? billingEnd : endDate;
    const daysUsed = Math.max(0, daysBetween(effectiveStart, effectiveEnd));
    const ratio = r2(daysUsed / totalDays);
    const proratedAmount = r2((totalAmount * daysUsed) / totalDays);

    return { proratedAmount, daysUsed, totalDays, ratio };
  });
}

export function calculateProration(input: ProrationInput): ProrationResult {
  const exit = Effect.runSyncExit(calculateProrateInternal(input));
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
}