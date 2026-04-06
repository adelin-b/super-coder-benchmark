import { Effect, Data, pipe } from "effect";

class ValidationError extends Data.TaggedError("ValidationError")<{
  reason: string;
}> {}

interface ProrateConfig {
  fullAmount: number;
  daysUsed: number;
  totalDaysInPeriod: number;
}

interface ProrateByDateConfig {
  fullAmount: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  serviceStart: Date;
  serviceEnd: Date;
}

function validateProrateConfig(config: ProrateConfig): Effect.Effect<ProrateConfig, ValidationError> {
  return Effect.gen(function* () {
    if (config.fullAmount < 0) {
      yield* Effect.fail(new ValidationError({ reason: "fullAmount must be non-negative" }));
    }
    if (config.daysUsed < 0) {
      yield* Effect.fail(new ValidationError({ reason: "daysUsed must be non-negative" }));
    }
    if (config.totalDaysInPeriod <= 0) {
      yield* Effect.fail(new ValidationError({ reason: "totalDaysInPeriod must be positive" }));
    }
    if (config.daysUsed > config.totalDaysInPeriod) {
      yield* Effect.fail(new ValidationError({ reason: "daysUsed cannot exceed totalDaysInPeriod" }));
    }
    return config;
  });
}

function calculateProrateInternal(config: ProrateConfig): Effect.Effect<number, ValidationError> {
  return Effect.gen(function* () {
    yield* validateProrateConfig(config);
    const ratio = config.daysUsed / config.totalDaysInPeriod;
    const proratedAmount = config.fullAmount * ratio;
    return Math.round(proratedAmount * 100) / 100;
  });
}

function calculateDaysBetween(start: Date, end: Date): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const diffMs = endMs - startMs;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function calculateProrateByDateInternal(
  config: ProrateByDateConfig
): Effect.Effect<number, ValidationError> {
  return Effect.gen(function* () {
    if (config.fullAmount < 0) {
      yield* Effect.fail(new ValidationError({ reason: "fullAmount must be non-negative" }));
    }
    if (config.billingPeriodStart >= config.billingPeriodEnd) {
      yield* Effect.fail(new ValidationError({ reason: "billingPeriodStart must be before billingPeriodEnd" }));
    }
    if (config.serviceStart > config.serviceEnd) {
      yield* Effect.fail(new ValidationError({ reason: "serviceStart must be before or equal to serviceEnd" }));
    }

    const totalDays = calculateDaysBetween(config.billingPeriodStart, config.billingPeriodEnd);
    const usageStart = new Date(Math.max(config.serviceStart.getTime(), config.billingPeriodStart.getTime()));
    const usageEnd = new Date(Math.min(config.serviceEnd.getTime(), config.billingPeriodEnd.getTime()));

    if (usageStart > usageEnd) {
      return 0;
    }

    const usedDays = calculateDaysBetween(usageStart, usageEnd);
    const ratio = usedDays / totalDays;
    const proratedAmount = config.fullAmount * ratio;
    return Math.round(proratedAmount * 100) / 100;
  });
}

export function calculateProration(fullAmount: number, daysUsed: number, totalDaysInPeriod: number): number {
  try {
    return Effect.runSync(
      calculateProrateInternal({
        fullAmount,
        daysUsed,
        totalDaysInPeriod,
      })
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("ValidationError")) {
      throw new Error((e as any).reason || "Validation failed");
    }
    throw e;
  }
}

export function calculateProratedCharge(
  fullAmount: number,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  serviceStart: Date,
  serviceEnd: Date
): number {
  try {
    return Effect.runSync(
      calculateProrateByDateInternal({
        fullAmount,
        billingPeriodStart,
        billingPeriodEnd,
        serviceStart,
        serviceEnd,
      })
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("ValidationError")) {
      throw new Error((e as any).reason || "Validation failed");
    }
    throw e;
  }
}

export function getRefund(fullAmount: number, daysUsed: number, totalDaysInPeriod: number): number {
  try {
    if (fullAmount < 0) throw new Error("fullAmount must be non-negative");
    if (daysUsed < 0) throw new Error("daysUsed must be non-negative");
    if (totalDaysInPeriod <= 0) throw new Error("totalDaysInPeriod must be positive");
    if (daysUsed > totalDaysInPeriod) throw new Error("daysUsed cannot exceed totalDaysInPeriod");

    const remainingDays = totalDaysInPeriod - daysUsed;
    const ratio = remainingDays / totalDaysInPeriod;
    const refundAmount = fullAmount * ratio;
    return Math.round(refundAmount * 100) / 100;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Refund calculation failed");
  }
}