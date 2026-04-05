export interface ProrateOptions {
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  usageStart: Date;
  usageEnd: Date;
}

export interface ProrateDaysOptions {
  amount: number;
  totalDays: number;
  usageDays: number;
}

export function prorate(options: ProrateOptions): number {
  const { amount, periodStart, periodEnd, usageStart, usageEnd } = options;

  const overlapStart = new Date(
    Math.max(periodStart.getTime(), usageStart.getTime())
  );
  const overlapEnd = new Date(
    Math.min(periodEnd.getTime(), usageEnd.getTime())
  );

  if (overlapStart >= overlapEnd) {
    return 0;
  }

  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const usageMs = overlapEnd.getTime() - overlapStart.getTime();

  return (amount * usageMs) / totalMs;
}

export function prorateByDays(options: ProrateDaysOptions): number {
  const { amount, totalDays, usageDays } = options;

  if (totalDays <= 0) {
    throw new Error("totalDays must be positive");
  }

  if (usageDays < 0 || usageDays > totalDays) {
    throw new Error("usageDays must be between 0 and totalDays");
  }

  return (amount * usageDays) / totalDays;
}

export function prorateByHours(options: {
  amount: number;
  totalHours: number;
  usageHours: number;
}): number {
  const { amount, totalHours, usageHours } = options;

  if (totalHours <= 0) {
    throw new Error("totalHours must be positive");
  }

  if (usageHours < 0 || usageHours > totalHours) {
    throw new Error("usageHours must be between 0 and totalHours");
  }

  return (amount * usageHours) / totalHours;
}