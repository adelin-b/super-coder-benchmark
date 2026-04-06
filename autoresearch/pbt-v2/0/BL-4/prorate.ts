interface ProrateOptions {
  roundingMode?: 'round' | 'floor' | 'ceil';
  decimalPlaces?: number;
}

interface ProrationResult {
  amount: number;
  daysUsed: number;
  totalDays: number;
}

function daysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function roundAmount(
  amount: number,
  mode: 'round' | 'floor' | 'ceil' = 'round',
  decimalPlaces: number = 2
): number {
  const multiplier = Math.pow(10, decimalPlaces);
  switch (mode) {
    case 'floor':
      return Math.floor(amount * multiplier) / multiplier;
    case 'ceil':
      return Math.ceil(amount * multiplier) / multiplier;
    case 'round':
    default:
      return Math.round(amount * multiplier) / multiplier;
  }
}

export function calculateProration(
  totalAmount: number,
  usageStartDate: Date,
  usageEndDate: Date,
  periodStartDate: Date,
  periodEndDate: Date,
  options?: ProrateOptions
): ProrationResult {
  const daysUsed = daysBetween(usageStartDate, usageEndDate);
  const totalDays = daysBetween(periodStartDate, periodEndDate);

  const proratedAmount = totalAmount * (daysUsed / totalDays);
  const roundedAmount = roundAmount(
    proratedAmount,
    options?.roundingMode ?? 'round',
    options?.decimalPlaces ?? 2
  );

  return {
    amount: roundedAmount,
    daysUsed,
    totalDays,
  };
}

export function prorateCharge(
  charge: number,
  daysUsed: number,
  totalDays: number,
  options?: ProrateOptions
): number {
  if (totalDays <= 0) {
    throw new Error('totalDays must be greater than 0');
  }
  if (daysUsed < 0) {
    throw new Error('daysUsed cannot be negative');
  }

  const proratedAmount = charge * (daysUsed / totalDays);
  return roundAmount(
    proratedAmount,
    options?.roundingMode ?? 'round',
    options?.decimalPlaces ?? 2
  );
}

export type { ProrateOptions, ProrationResult };