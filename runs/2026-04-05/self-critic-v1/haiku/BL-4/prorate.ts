export interface ProrateInput {
  chargeAmount: number;
  fullPeriodStart: Date;
  fullPeriodEnd: Date;
  partialPeriodStart: Date;
  partialPeriodEnd: Date;
}

export interface ProrateResult {
  proratedAmount: number;
  daysInFullPeriod: number;
  daysInPartialPeriod: number;
  rate: number;
}

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export function calculateProration(input: ProrateInput): ProrateResult {
  const {
    chargeAmount,
    fullPeriodStart,
    fullPeriodEnd,
    partialPeriodStart,
    partialPeriodEnd,
  } = input;

  // Validate inputs
  if (chargeAmount < 0) {
    throw new ProrateError('Charge amount cannot be negative');
  }

  if (fullPeriodStart >= fullPeriodEnd) {
    throw new ProrateError('Full period start must be before end');
  }

  if (partialPeriodStart >= partialPeriodEnd) {
    throw new ProrateError('Partial period start must be before end');
  }

  if (partialPeriodStart < fullPeriodStart || partialPeriodEnd > fullPeriodEnd) {
    throw new ProrateError('Partial period must be within full period');
  }

  const fullDays = calculateDaysBetween(fullPeriodStart, fullPeriodEnd);
  const partialDays = calculateDaysBetween(partialPeriodStart, partialPeriodEnd);

  if (fullDays <= 0) {
    throw new ProrateError('Full period must have positive duration');
  }

  const rate = partialDays / fullDays;
  const proratedAmount = chargeAmount * rate;

  return {
    proratedAmount: Math.round(proratedAmount * 100) / 100,
    daysInFullPeriod: Math.round(fullDays * 100) / 100,
    daysInPartialPeriod: Math.round(partialDays * 100) / 100,
    rate: Math.round(rate * 10000) / 10000,
  };
}

function calculateDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = end.getTime() - start.getTime();
  return diffMs / msPerDay;
}

export function prorateCharge(
  amount: number,
  fullStart: Date,
  fullEnd: Date,
  partialStart: Date,
  partialEnd: Date
): number {
  return calculateProration({
    chargeAmount: amount,
    fullPeriodStart: fullStart,
    fullPeriodEnd: fullEnd,
    partialPeriodStart: partialStart,
    partialPeriodEnd: partialEnd,
  }).proratedAmount;
}