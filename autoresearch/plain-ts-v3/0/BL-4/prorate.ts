export interface ProrateResult {
  periodStart: Date;
  periodEnd: Date;
  changeDate: Date;
  daysBeforeChange: number;
  daysAfterChange: number;
  totalDays: number;
  amountBeforeChange: number;
  amountAfterChange: number;
  totalAmount: number;
}

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export function calculateProration(
  totalAmount: number,
  periodStart: Date,
  periodEnd: Date,
  changeDate: Date
): ProrateResult {
  // Validate amount
  if (typeof totalAmount !== 'number' || !isFinite(totalAmount)) {
    throw new ProrateError('Total amount must be a finite number');
  }

  if (totalAmount < 0) {
    throw new ProrateError('Total amount cannot be negative');
  }

  // Validate dates
  if (!isValidDate(periodStart)) {
    throw new ProrateError('Period start date is invalid');
  }

  if (!isValidDate(periodEnd)) {
    throw new ProrateError('Period end date is invalid');
  }

  if (!isValidDate(changeDate)) {
    throw new ProrateError('Change date is invalid');
  }

  // Normalize dates to midnight UTC for accurate day calculation
  const start = normalizeDate(periodStart);
  const end = normalizeDate(periodEnd);
  const change = normalizeDate(changeDate);

  // Validate date relationships
  if (start > end) {
    throw new ProrateError('Period start date cannot be after period end date');
  }

  if (change < start) {
    throw new ProrateError('Change date cannot be before period start date');
  }

  if (change > end) {
    throw new ProrateError('Change date cannot be after period end date');
  }

  // Calculate number of days in each period
  // Including both start and end dates
  const totalDays = daysBetween(start, end) + 1;

  if (totalDays === 0) {
    throw new ProrateError('Period must span at least one day');
  }

  // Days from start to change (inclusive)
  const daysBeforeChange = daysBetween(start, change) + 1;
  // Days from after change to end (inclusive)
  const daysAfterChange = totalDays - daysBeforeChange;

  // Calculate prorated amounts based on proportional days
  const amountBeforeChange = (totalAmount * daysBeforeChange) / totalDays;
  const amountAfterChange = totalAmount - amountBeforeChange;

  // Round to 2 decimal places to avoid floating point precision issues
  const roundedBefore = Math.round(amountBeforeChange * 100) / 100;
  const roundedAfter = Math.round(amountAfterChange * 100) / 100;

  return {
    periodStart: start,
    periodEnd: end,
    changeDate: change,
    daysBeforeChange,
    daysAfterChange,
    totalDays,
    amountBeforeChange: roundedBefore,
    amountAfterChange: roundedAfter,
    totalAmount
  };
}

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function daysBetween(startDate: Date, endDate: Date): number {
  const timeInMs = endDate.getTime() - startDate.getTime();
  return Math.floor(timeInMs / (1000 * 60 * 60 * 24));
}