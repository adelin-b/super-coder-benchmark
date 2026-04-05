export interface ProrateOptions {
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  periodStart: Date;
  periodEnd: Date;
}

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export function calculateProratedAmount(options: ProrateOptions): number {
  // Validation
  if (options.totalAmount < 0) {
    throw new ProrateError('Total amount cannot be negative');
  }
  if (options.startDate > options.endDate) {
    throw new ProrateError('Start date cannot be after end date');
  }
  if (options.periodStart > options.periodEnd) {
    throw new ProrateError('Period start cannot be after period end');
  }

  // Calculate the actual date range within the period
  const actualStart = options.startDate > options.periodStart ? options.startDate : options.periodStart;
  const actualEnd = options.endDate < options.periodEnd ? options.endDate : options.periodEnd;

  // If no overlap, return 0
  if (actualStart >= actualEnd) {
    return 0;
  }

  // Calculate days used and total days in period
  const daysUsed = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24);
  const totalDays = (options.periodEnd.getTime() - options.periodStart.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate ratio and apply to total amount
  const ratio = totalDays > 0 ? daysUsed / totalDays : 0;
  return options.totalAmount * ratio;
}

export function calculateDailyRate(
  totalAmount: number,
  periodStart: Date,
  periodEnd: Date
): number {
  // Validation
  if (totalAmount < 0) {
    throw new ProrateError('Total amount cannot be negative');
  }
  if (periodStart > periodEnd) {
    throw new ProrateError('Period start cannot be after period end');
  }

  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

  if (totalDays <= 0) {
    throw new ProrateError('Period must span at least one day');
  }

  return totalAmount / totalDays;
}

export function prorateCharge(
  totalAmount: number,
  startDate: Date,
  endDate: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  return calculateProratedAmount({
    totalAmount,
    startDate,
    endDate,
    periodStart,
    periodEnd
  });
}