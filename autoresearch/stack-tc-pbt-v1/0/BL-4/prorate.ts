export interface ProrateResult {
  dailyRate: number;
  proratedAmount: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Calculates the number of days between two dates (inclusive of start, exclusive of end).
 */
export function daysBetween(start: Date, end: Date): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the daily rate for a charge amount spread over a number of days.
 */
export function calculateDailyRate(amount: number, days: number): number {
  if (days <= 0) {
    throw new Error("Days must be greater than 0");
  }
  if (amount < 0) {
    throw new Error("Amount cannot be negative");
  }
  return amount / days;
}

/**
 * Prorates an amount based on the number of days used relative to total days in a period.
 */
export function prorateAmount(amount: number, daysUsed: number, totalDays: number): number {
  if (totalDays <= 0) {
    throw new Error("Total days must be greater than 0");
  }
  if (daysUsed < 0 || daysUsed > totalDays) {
    throw new Error("Days used must be between 0 and total days");
  }
  if (amount < 0) {
    throw new Error("Amount cannot be negative");
  }
  const dailyRate = amount / totalDays;
  return Math.round(dailyRate * daysUsed * 100) / 100;
}

/**
 * Calculates a prorated charge for a partial billing period.
 * Returns the daily rate and the prorated amount for the actual usage period.
 */
export function prorateCharge(
  chargeAmount: number,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  usageStart: Date,
  usageEnd: Date
): ProrateResult {
  if (chargeAmount < 0) {
    throw new Error("Charge amount cannot be negative");
  }

  const totalDays = daysBetween(billingPeriodStart, billingPeriodEnd);
  if (totalDays <= 0) {
    throw new Error("Billing period must span at least 1 day");
  }

  const usedDays = daysBetween(usageStart, usageEnd);
  if (usedDays < 0) {
    throw new Error("Usage end cannot be before usage start");
  }

  const dailyRate = chargeAmount / totalDays;
  const proratedAmount = Math.round(dailyRate * usedDays * 100) / 100;

  return {
    dailyRate,
    proratedAmount,
  };
}

/**
 * Splits a charge across multiple time periods proportionally.
 */
export function splitCharge(
  chargeAmount: number,
  periods: DateRange[],
  usageStart: Date,
  usageEnd: Date
): number[] {
  if (chargeAmount < 0) {
    throw new Error("Charge amount cannot be negative");
  }
  if (periods.length === 0) {
    throw new Error("At least one period is required");
  }

  const totalDays = periods.reduce((sum, period) => {
    const days = daysBetween(period.start, period.end);
    if (days <= 0) {
      throw new Error("Each period must span at least 1 day");
    }
    return sum + days;
  }, 0);

  const dailyRate = chargeAmount / totalDays;

  return periods.map((period) => {
    const periodStart = new Date(Math.max(period.start.getTime(), usageStart.getTime()));
    const periodEnd = new Date(Math.min(period.end.getTime(), usageEnd.getTime()));

    if (periodStart >= periodEnd) {
      return 0;
    }

    const usedDays = daysBetween(periodStart, periodEnd);
    return Math.round(dailyRate * usedDays * 100) / 100;
  });
}