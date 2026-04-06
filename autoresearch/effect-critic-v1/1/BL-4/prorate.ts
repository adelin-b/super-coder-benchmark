import { Effect, Data } from "effect";

class ProrateError extends Data.TaggedError("ProrateError")<{
  reason: string;
}> {}

export class ProrateError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProrateError";
  }
}

interface ProrateInput {
  totalAmount: number;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  billingStart: string;
  billingEnd: string;
}

interface ProrateResult {
  proratedAmount: number;
  ratio: number;
  daysUsed: number;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

function daysBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const calculateProrateInternal = (input: ProrateInput): Effect.Effect<ProrateResult, ProrateError> => {
  return Effect.gen(function* () {
    const { totalAmount, startDate, endDate, billingStart, billingEnd } = input;

    // Validate inputs
    if (totalAmount < 0) {
      yield* Effect.fail(new ProrateError("totalAmount cannot be negative"));
    }

    const billingStartDate = parseDate(billingStart);
    const billingEndDate = parseDate(billingEnd);

    if (billingStartDate > billingEndDate) {
      yield* Effect.fail(new ProrateError("billingStart must be before or equal to billingEnd"));
    }

    const serviceStartDate = parseDate(startDate);
    const serviceEndDate = parseDate(endDate);

    // Calculate overlap between service period and billing period
    const overlapStart = new Date(Math.max(serviceStartDate.getTime(), billingStartDate.getTime()));
    const overlapEnd = new Date(Math.min(serviceEndDate.getTime(), billingEndDate.getTime()));

    // If there's no overlap, return zero
    let daysUsed = 0;
    if (overlapStart <= overlapEnd) {
      daysUsed = daysBetween(overlapStart, overlapEnd);
    }

    const billingDays = daysBetween(billingStartDate, billingEndDate);
    const ratio = billingDays > 0 ? daysUsed / billingDays : 0;
    const proratedAmount = totalAmount * ratio;

    return {
      proratedAmount,
      ratio,
      daysUsed,
    };
  });
};

export function calculateProration(input: ProrateInput): ProrateResult {
  if (input.totalAmount < 0) {
    throw new ProrateError("totalAmount cannot be negative");
  }

  const billingStartDate = parseDate(input.billingStart);
  const billingEndDate = parseDate(input.billingEnd);

  if (billingStartDate > billingEndDate) {
    throw new ProrateError("billingStart must be before or equal to billingEnd");
  }

  const serviceStartDate = parseDate(input.startDate);
  const serviceEndDate = parseDate(input.endDate);

  // Calculate overlap between service period and billing period
  const overlapStart = new Date(Math.max(serviceStartDate.getTime(), billingStartDate.getTime()));
  const overlapEnd = new Date(Math.min(serviceEndDate.getTime(), billingEndDate.getTime()));

  // If there's no overlap, return zero
  let daysUsed = 0;
  if (overlapStart <= overlapEnd) {
    daysUsed = daysBetween(overlapStart, overlapEnd);
  }

  const billingDays = daysBetween(billingStartDate, billingEndDate);
  const ratio = billingDays > 0 ? daysUsed / billingDays : 0;
  const proratedAmount = input.totalAmount * ratio;

  return {
    proratedAmount,
    ratio,
    daysUsed,
  };
}