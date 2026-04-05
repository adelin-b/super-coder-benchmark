export function prorateCharge(
  chargeAmount: number,
  periodStart: Date,
  periodEnd: Date,
  usageStart: Date,
  usageEnd: Date
): number {
  // Validation
  if (typeof chargeAmount !== 'number' || chargeAmount < 0) {
    throw new Error('Charge amount must be a non-negative number');
  }
  if (!(periodStart instanceof Date) || !isValidDate(periodStart)) {
    throw new Error('Period start must be a valid Date');
  }
  if (!(periodEnd instanceof Date) || !isValidDate(periodEnd)) {
    throw new Error('Period end must be a valid Date');
  }
  if (!(usageStart instanceof Date) || !isValidDate(usageStart)) {
    throw new Error('Usage start must be a valid Date');
  }
  if (!(usageEnd instanceof Date) || !isValidDate(usageEnd)) {
    throw new Error('Usage end must be a valid Date');
  }
  if (periodStart.getTime() >= periodEnd.getTime()) {
    throw new Error('Period start must be before period end');
  }
  if (usageStart.getTime() >= usageEnd.getTime()) {
    throw new Error('Usage start must be before usage end');
  }

  // Clamp usage period to billing period
  const clampedStart = new Date(
    Math.max(usageStart.getTime(), periodStart.getTime())
  );
  const clampedEnd = new Date(
    Math.min(usageEnd.getTime(), periodEnd.getTime())
  );

  // Calculate proration ratio
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const usedMs = clampedEnd.getTime() - clampedStart.getTime();
  const ratio = usedMs / totalMs;

  return chargeAmount * ratio;
}

function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

export interface ProrateResult {
  amount: number;
  ratio: number;
  daysUsed: number;
  totalDays: number;
}

export function prorateChargeDetailed(
  chargeAmount: number,
  periodStart: Date,
  periodEnd: Date,
  usageStart: Date,
  usageEnd: Date
): ProrateResult {
  // Validation
  if (typeof chargeAmount !== 'number' || chargeAmount < 0) {
    throw new Error('Charge amount must be a non-negative number');
  }
  if (!(periodStart instanceof Date) || !isValidDate(periodStart)) {
    throw new Error('Period start must be a valid Date');
  }
  if (!(periodEnd instanceof Date) || !isValidDate(periodEnd)) {
    throw new Error('Period end must be a valid Date');
  }
  if (!(usageStart instanceof Date) || !isValidDate(usageStart)) {
    throw new Error('Usage start must be a valid Date');
  }
  if (!(usageEnd instanceof Date) || !isValidDate(usageEnd)) {
    throw new Error('Usage end must be a valid Date');
  }
  if (periodStart.getTime() >= periodEnd.getTime()) {
    throw new Error('Period start must be before period end');
  }
  if (usageStart.getTime() >= usageEnd.getTime()) {
    throw new Error('Usage start must be before usage end');
  }

  // Clamp usage period to billing period
  const clampedStart = new Date(
    Math.max(usageStart.getTime(), periodStart.getTime())
  );
  const clampedEnd = new Date(
    Math.min(usageEnd.getTime(), periodEnd.getTime())
  );

  // Calculate proration ratio
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const usedMs = clampedEnd.getTime() - clampedStart.getTime();
  const ratio = usedMs / totalMs;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUsed = Math.round((usedMs / msPerDay) * 100) / 100;
  const totalDays = Math.round((totalMs / msPerDay) * 100) / 100;

  return {
    amount: chargeAmount * ratio,
    ratio,
    daysUsed,
    totalDays
  };
}