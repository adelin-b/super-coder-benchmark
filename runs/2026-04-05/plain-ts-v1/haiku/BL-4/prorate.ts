export interface DateRange {
  start: Date;
  end: Date;
}

export interface ProrationRequest {
  fullAmount: number;
  fullPeriod: DateRange;
  usagePeriod: DateRange;
}

export interface ProrationResult {
  amount: number;
  daysUsed: number;
  daysInPeriod: number;
  percentage: number;
}

export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / msPerDay);
}

export function prorate(request: ProrationRequest): ProrationResult {
  if (request.fullAmount < 0) {
    throw new ProrateError('Full amount cannot be negative');
  }

  if (request.fullPeriod.start >= request.fullPeriod.end) {
    throw new ProrateError('Full period start must be before end');
  }

  if (request.usagePeriod.start >= request.usagePeriod.end) {
    throw new ProrateError('Usage period start must be before end');
  }

  const daysInPeriod = getDaysBetween(request.fullPeriod.start, request.fullPeriod.end);

  const overlapStart = new Date(
    Math.max(request.fullPeriod.start.getTime(), request.usagePeriod.start.getTime())
  );
  const overlapEnd = new Date(
    Math.min(request.fullPeriod.end.getTime(), request.usagePeriod.end.getTime())
  );

  if (overlapStart >= overlapEnd) {
    return {
      amount: 0,
      daysUsed: 0,
      daysInPeriod,
      percentage: 0,
    };
  }

  const daysUsed = getDaysBetween(overlapStart, overlapEnd);
  const percentage = daysUsed / daysInPeriod;
  const amount = request.fullAmount * percentage;

  return {
    amount: Math.round(amount * 100) / 100,
    daysUsed,
    daysInPeriod,
    percentage: Math.round(percentage * 10000) / 10000,
  };
}

export function prorateMultiple(
  fullAmount: number,
  fullPeriod: DateRange,
  periods: DateRange[]
): ProrationResult[] {
  return periods.map((period) =>
    prorate({
      fullAmount,
      fullPeriod,
      usagePeriod: period,
    })
  );
}

export function calculateCredit(
  fullAmount: number,
  fullPeriod: DateRange,
  cancelDate: Date
): ProrationResult {
  return prorate({
    fullAmount,
    fullPeriod,
    usagePeriod: {
      start: fullPeriod.start,
      end: cancelDate,
    },
  });
}

export function calculateDailyRate(fullAmount: number, daysInPeriod: number): number {
  if (daysInPeriod <= 0) {
    throw new ProrateError('Days in period must be greater than 0');
  }
  return Math.round((fullAmount / daysInPeriod) * 100) / 100;
}

export function calculateChargeForDays(
  dailyRate: number,
  startDate: Date,
  endDate: Date
): number {
  if (dailyRate < 0) {
    throw new ProrateError('Daily rate cannot be negative');
  }
  if (startDate >= endDate) {
    throw new ProrateError('Start date must be before end date');
  }
  const daysInPeriod = getDaysBetween(startDate, endDate);
  return Math.round(dailyRate * daysInPeriod * 100) / 100;
}

export function splitCharge(
  fullAmount: number,
  fullPeriod: DateRange,
  splitDates: Date[]
): ProrationResult[] {
  if (splitDates.length === 0) {
    throw new ProrateError('At least one split date is required');
  }

  const sortedDates = [fullPeriod.start, ...splitDates.sort((a, b) => a.getTime() - b.getTime()), fullPeriod.end];
  const periods: DateRange[] = [];

  for (let i = 0; i < sortedDates.length - 1; i++) {
    periods.push({
      start: sortedDates[i],
      end: sortedDates[i + 1],
    });
  }

  return prorateMultiple(fullAmount, fullPeriod, periods);
}