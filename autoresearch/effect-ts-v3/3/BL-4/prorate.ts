import { Effect } from "effect";

function calculateProrateEffect(
  amount: number,
  periodStart: Date,
  periodEnd: Date,
  activeStart: Date,
  activeEnd: Date
): Effect.Effect<number, Error> {
  return Effect.sync(() => {
    // Guard: ensure we have real Date objects
    const start = periodStart instanceof Date ? periodStart : new Date(periodStart);
    const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    const actStart = activeStart instanceof Date ? activeStart : new Date(activeStart);
    const actEnd = activeEnd instanceof Date ? activeEnd : new Date(activeEnd);

    // Validation
    if (amount < 0) throw new Error("Amount cannot be negative");
    if (start.getTime() >= end.getTime()) throw new Error("Invalid billing period: start must be before end");
    if (actStart.getTime() > actEnd.getTime()) throw new Error("Invalid active period: start must be before or equal to end");

    // Calculate the overlap between the billing period and active period
    const overlapStart = new Date(Math.max(start.getTime(), actStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), actEnd.getTime()));

    // If no overlap, proration is 0
    if (overlapStart.getTime() >= overlapEnd.getTime()) return 0;

    // Calculate days (use milliseconds for precision)
    const totalPeriodMs = end.getTime() - start.getTime();
    const activePeriodMs = overlapEnd.getTime() - overlapStart.getTime();

    // Calculate prorated amount
    const prorated = (amount * activePeriodMs) / totalPeriodMs;

    // Round to 2 decimal places for currency
    return Math.round(prorated * 100) / 100;
  });
}

export function calculateProration(
  amount: number,
  periodStart: Date,
  periodEnd: Date,
  activeStart: Date,
  activeEnd: Date
): number {
  return Effect.runSync(
    calculateProrateEffect(amount, periodStart, periodEnd, activeStart, activeEnd)
  );
}