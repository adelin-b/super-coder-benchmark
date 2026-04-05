export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export interface ProrateResult {
  amount: number;
  days: number;
}

export interface ProratedPeriod {
  startDate: Date;
  endDate: Date;
  amount: number;
  days: number;
}

export function calculateDays(startDate: Date, endDate: Date): number {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new ProrateError('Start and end dates must be Date objects');
  }
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ProrateError('Invalid date provided');
  }
  if (startDate > endDate) {
    throw new ProrateError('Start date cannot be after end date');
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function calculateDailyRate(
  chargeAmount: number,
  periodDays: number
): number {
  if (!isFinite(chargeAmount)) {
    throw new ProrateError('Charge amount must be a finite number');
  }
  if (periodDays <= 0) {
    throw new ProrateError('Period days must be greater than 0');
  }
  return chargeAmount / periodDays;
}

export function prorateCharge(
  chargeAmount: number,
  startDate: Date,
  endDate: Date,
  fullPeriodDays: number
): ProrateResult {
  if (!isFinite(chargeAmount)) {
    throw new ProrateError('Charge amount must be a finite number');
  }
  if (fullPeriodDays <= 0) {
    throw new ProrateError('Full period days must be greater than 0');
  }

  const days = calculateDays(startDate, endDate);
  const dailyRate = calculateDailyRate(chargeAmount, fullPeriodDays);
  const proratedAmount = dailyRate * days;

  return {
    amount: Math.round(proratedAmount * 100) / 100,
    days,
  };
}

export function calculateRefund(
  chargeAmount: number,
  periodStartDate: Date,
  periodEndDate: Date,
  cancellationDate: Date
): number {
  if (!isFinite(chargeAmount)) {
    throw new ProrateError('Charge amount must be a finite number');
  }

  const totalDays = calculateDays(periodStartDate, periodEndDate);
  const usedDays = calculateDays(periodStartDate, cancellationDate);
  const remainingDays = totalDays - usedDays;

  if (remainingDays <= 0) {
    return 0;
  }

  const dailyRate = calculateDailyRate(chargeAmount, totalDays);
  const refundAmount = dailyRate * remainingDays;

  return Math.round(refundAmount * 100) / 100;
}

export function splitCharge(
  chargeAmount: number,
  startDate: Date,
  endDate: Date,
  fullPeriodDays: number
): ProratedPeriod[] {
  if (!isFinite(chargeAmount)) {
    throw new ProrateError('Charge amount must be a finite number');
  }
  if (fullPeriodDays <= 0) {
    throw new ProrateError('Full period days must be greater than 0');
  }

  const totalDays = calculateDays(startDate, endDate);
  const dailyRate = calculateDailyRate(chargeAmount, fullPeriodDays);

  const periods: ProratedPeriod[] = [];
  let currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const periodEnd = nextDay > endDate ? endDate : nextDay;

    const periodDays = calculateDays(currentDate, periodEnd);
    const periodAmount = Math.round(dailyRate * periodDays * 100) / 100;

    periods.push({
      startDate: new Date(currentDate),
      endDate: new Date(periodEnd),
      amount: periodAmount,
      days: periodDays,
    });

    currentDate = periodEnd;
  }

  return periods;
}