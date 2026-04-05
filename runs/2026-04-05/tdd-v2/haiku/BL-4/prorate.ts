export interface ProrateOptions {
  amount: number;
  startDate: Date;
  endDate: Date;
  periodStart: Date;
  periodEnd: Date;
}

export interface ProrateResult {
  proratedAmount: number;
  daysUsed: number;
  daysInPeriod: number;
}

export function getDaysInRange(start: Date, end: Date): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

export function calculateDailyRate(
  amount: number,
  daysInPeriod: number
): number {
  if (daysInPeriod <= 0) {
    return 0;
  }
  return amount / daysInPeriod;
}

export function prorateAmount(options: ProrateOptions): ProrateResult {
  const { amount, startDate, endDate, periodStart, periodEnd } = options;

  const daysInPeriod = getDaysInRange(periodStart, periodEnd);
  const daysUsed = getDaysInRange(startDate, endDate);

  const clampedDaysUsed = Math.min(daysUsed, daysInPeriod);

  const dailyRate = calculateDailyRate(amount, daysInPeriod);
  const proratedAmount = dailyRate * clampedDaysUsed;

  return {
    proratedAmount: Math.max(0, proratedAmount),
    daysUsed: clampedDaysUsed,
    daysInPeriod,
  };
}

export function prorateByPeriods(
  amount: number,
  periods: Array<{ start: Date; end: Date }>
): Array<{ period: { start: Date; end: Date }; amount: number }> {
  if (periods.length === 0) {
    return [];
  }

  const totalDays = periods.reduce(
    (sum, period) => sum + getDaysInRange(period.start, period.end),
    0
  );

  if (totalDays === 0) {
    return periods.map((period) => ({ period, amount: 0 }));
  }

  const dailyRate = amount / totalDays;

  return periods.map((period) => ({
    period,
    amount: dailyRate * getDaysInRange(period.start, period.end),
  }));
}