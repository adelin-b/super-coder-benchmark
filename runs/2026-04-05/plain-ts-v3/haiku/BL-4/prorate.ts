export interface ProrateInput {
  charge: number;
  usedDays: number;
  totalDays: number;
}

export interface ProrateResult {
  prorated: number;
  dailyRate: number;
}

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

function validateProrateInput(input: ProrateInput): void {
  if (input.charge < 0) {
    throw new ProrateError('Charge cannot be negative');
  }
  if (input.usedDays < 0) {
    throw new ProrateError('Used days cannot be negative');
  }
  if (input.totalDays <= 0) {
    throw new ProrateError('Total days must be greater than 0');
  }
  if (input.usedDays > input.totalDays) {
    throw new ProrateError('Used days cannot exceed total days');
  }
}

export function prorate(input: ProrateInput): ProrateResult {
  validateProrateInput(input);

  const dailyRate = input.charge / input.totalDays;
  const prorated = dailyRate * input.usedDays;

  return {
    prorated: Math.round(prorated * 100) / 100,
    dailyRate: Math.round(dailyRate * 100) / 100,
  };
}

function calculateDaysBetween(start: Date, end: Date): number {
  if (start > end) {
    throw new ProrateError('Start date must be before or equal to end date');
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / msPerDay);
}

export function prorateByDates(
  charge: number,
  usedStart: Date,
  usedEnd: Date,
  periodStart: Date,
  periodEnd: Date
): ProrateResult {
  if (!(usedStart instanceof Date) || !(usedEnd instanceof Date)) {
    throw new ProrateError('Used start and end must be valid Date objects');
  }
  if (!(periodStart instanceof Date) || !(periodEnd instanceof Date)) {
    throw new ProrateError('Period start and end must be valid Date objects');
  }

  const usedDays = calculateDaysBetween(usedStart, usedEnd);
  const totalDays = calculateDaysBetween(periodStart, periodEnd);

  return prorate({
    charge,
    usedDays,
    totalDays,
  });
}

export function prorateRefund(
  charge: number,
  remainingDays: number,
  totalDays: number
): ProrateResult {
  return prorate({
    charge,
    usedDays: remainingDays,
    totalDays,
  });
}

export function prorateUpgrade(
  previousCharge: number,
  newCharge: number,
  usedDays: number,
  totalDays: number
): number {
  const previousProrate = prorate({
    charge: previousCharge,
    usedDays,
    totalDays,
  });
  const newProrate = prorate({
    charge: newCharge,
    usedDays,
    totalDays,
  });
  const difference = newProrate.prorated - previousProrate.prorated;
  return Math.round(difference * 100) / 100;
}