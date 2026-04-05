export class ProrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrationError';
  }
}

export interface ProrateResult {
  proratedAmount: number;
  dailyRate: number;
  daysUsed: number;
}

/**
 * Calculate the daily rate for a charge over a period
 */
export function calculateDailyRate(
  totalCharge: number,
  totalDays: number
): number {
  if (totalDays <= 0) {
    throw new ProrationError('Total days must be greater than 0');
  }
  if (totalCharge < 0) {
    throw new ProrationError('Total charge cannot be negative');
  }

  return totalCharge / totalDays;
}

/**
 * Calculate prorated charge based on days used
 */
export function prorateByDays(
  totalCharge: number,
  totalDays: number,
  daysUsed: number
): number {
  if (totalDays <= 0) {
    throw new ProrationError('Total days must be greater than 0');
  }
  if (totalCharge < 0) {
    throw new ProrationError('Total charge cannot be negative');
  }
  if (daysUsed < 0) {
    throw new ProrationError('Days used cannot be negative');
  }
  if (daysUsed > totalDays) {
    throw new ProrationError('Days used cannot exceed total days');
  }

  const dailyRate = calculateDailyRate(totalCharge, totalDays);
  return dailyRate * daysUsed;
}

/**
 * Calculate prorated charge with detailed result
 */
export function prorateWithDetails(
  totalCharge: number,
  totalDays: number,
  daysUsed: number
): ProrateResult {
  const dailyRate = calculateDailyRate(totalCharge, totalDays);
  const proratedAmount = prorateByDays(totalCharge, totalDays, daysUsed);

  return {
    proratedAmount,
    dailyRate,
    daysUsed,
  };
}

/**
 * Calculate prorated charge based on date range
 * Uses inclusive day counting
 */
export function prorateByDateRange(
  chargeStartDate: Date,
  chargeEndDate: Date,
  totalCharge: number,
  periodStartDate: Date,
  periodEndDate: Date
): number {
  if (!(chargeStartDate instanceof Date) || isNaN(chargeStartDate.getTime())) {
    throw new ProrationError('chargeStartDate must be a valid Date');
  }
  if (!(chargeEndDate instanceof Date) || isNaN(chargeEndDate.getTime())) {
    throw new ProrationError('chargeEndDate must be a valid Date');
  }
  if (!(periodStartDate instanceof Date) || isNaN(periodStartDate.getTime())) {
    throw new ProrationError('periodStartDate must be a valid Date');
  }
  if (!(periodEndDate instanceof Date) || isNaN(periodEndDate.getTime())) {
    throw new ProrationError('periodEndDate must be a valid Date');
  }
  if (chargeStartDate > chargeEndDate) {
    throw new ProrationError('chargeStartDate must be before or equal to chargeEndDate');
  }
  if (periodStartDate > periodEndDate) {
    throw new ProrationError('periodStartDate must be before or equal to periodEndDate');
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUsed = Math.ceil((chargeEndDate.getTime() - chargeStartDate.getTime()) / msPerDay) + 1;
  const totalDays = Math.ceil((periodEndDate.getTime() - periodStartDate.getTime()) / msPerDay) + 1;

  return prorateByDays(totalCharge, totalDays, daysUsed);
}

/**
 * Calculate the credit (amount not charged) based on days not used
 */
export function calculateCredit(
  totalCharge: number,
  totalDays: number,
  daysUsed: number
): number {
  const proratedAmount = prorateByDays(totalCharge, totalDays, daysUsed);
  return totalCharge - proratedAmount;
}

/**
 * Split a charge across multiple periods
 */
export function splitChargePeriods(
  totalCharge: number,
  periodDaysCounts: number[]
): number[] {
  if (!Array.isArray(periodDaysCounts) || periodDaysCounts.length === 0) {
    throw new ProrationError('Period days counts must be a non-empty array');
  }
  if (totalCharge < 0) {
    throw new ProrationError('Total charge cannot be negative');
  }

  const totalDays = periodDaysCounts.reduce((sum, days) => sum + days, 0);
  if (totalDays <= 0) {
    throw new ProrationError('Total days must be greater than 0');
  }

  const dailyRate = calculateDailyRate(totalCharge, totalDays);
  return periodDaysCounts.map((days) => {
    if (days < 0) {
      throw new ProrationError('Period days cannot be negative');
    }
    return dailyRate * days;
  });
}