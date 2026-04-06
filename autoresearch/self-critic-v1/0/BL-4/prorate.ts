export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export interface ProrateInput {
  totalCharge: number;
  startDate: Date;
  endDate: Date;
  billingPeriodDays?: number;
}

export interface ProrateOutput {
  dailyRate: number;
  proratedCharge: number;
  daysInPeriod: number;
}

export function prorate(input: ProrateInput): ProrateOutput {
  const { totalCharge, startDate, endDate, billingPeriodDays = 30 } = input;

  if (totalCharge < 0) {
    throw new ProrateError('Total charge cannot be negative');
  }

  if (billingPeriodDays <= 0) {
    throw new ProrateError('Billing period days must be positive');
  }

  if (startDate >= endDate) {
    throw new ProrateError('Start date must be before end date');
  }

  const daysInPeriod = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dailyRate = totalCharge / billingPeriodDays;
  const proratedCharge = dailyRate * daysInPeriod;

  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    proratedCharge: Math.round(proratedCharge * 100) / 100,
    daysInPeriod,
  };
}

export function calculateDailyRate(
  totalCharge: number,
  billingPeriodDays: number = 30
): number {
  if (totalCharge < 0) {
    throw new ProrateError('Total charge cannot be negative');
  }

  if (billingPeriodDays <= 0) {
    throw new ProrateError('Billing period days must be positive');
  }

  return Math.round((totalCharge / billingPeriodDays) * 100) / 100;
}

export function prorateByDays(
  totalCharge: number,
  daysInPeriod: number,
  billingPeriodDays: number = 30
): number {
  if (totalCharge < 0) {
    throw new ProrateError('Total charge cannot be negative');
  }

  if (daysInPeriod < 0) {
    throw new ProrateError('Days in period cannot be negative');
  }

  if (billingPeriodDays <= 0) {
    throw new ProrateError('Billing period days must be positive');
  }

  const dailyRate = totalCharge / billingPeriodDays;
  return Math.round(dailyRate * daysInPeriod * 100) / 100;
}