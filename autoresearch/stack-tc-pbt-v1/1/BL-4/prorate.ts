export function calculateProration(
  charge: number,
  totalDays: number,
  applicableDays: number
): number {
  if (totalDays <= 0) {
    throw new Error("totalDays must be greater than 0");
  }
  if (applicableDays < 0 || applicableDays > totalDays) {
    throw new Error("applicableDays must be between 0 and totalDays inclusive");
  }
  if (charge < 0) {
    throw new Error("charge must be non-negative");
  }

  const dailyRate = charge / totalDays;
  return dailyRate * applicableDays;
}

export function calculateProrationByDates(
  charge: number,
  periodStart: Date,
  periodEnd: Date,
  effectiveStart: Date,
  effectiveEnd: Date
): number {
  if (charge < 0) {
    throw new Error("charge must be non-negative");
  }
  if (periodStart >= periodEnd) {
    throw new Error("periodStart must be before periodEnd");
  }
  if (effectiveStart >= effectiveEnd) {
    throw new Error("effectiveStart must be before effectiveEnd");
  }
  if (effectiveStart < periodStart || effectiveEnd > periodEnd) {
    throw new Error("effective period must be within billing period");
  }

  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const applicableMs = effectiveEnd.getTime() - effectiveStart.getTime();

  const dailyRate = charge / (totalMs / (1000 * 60 * 60 * 24));
  return dailyRate * (applicableMs / (1000 * 60 * 60 * 24));
}

export function splitCharge(
  charge: number,
  periods: Array<{ days: number }>
): number[] {
  if (charge < 0) {
    throw new Error("charge must be non-negative");
  }
  if (!periods || periods.length === 0) {
    throw new Error("periods must not be empty");
  }

  const totalDays = periods.reduce((sum, p) => sum + p.days, 0);
  if (totalDays <= 0) {
    throw new Error("total days across all periods must be greater than 0");
  }

  for (const period of periods) {
    if (period.days < 0) {
      throw new Error("each period days must be non-negative");
    }
  }

  const dailyRate = charge / totalDays;
  return periods.map((p) => dailyRate * p.days);
}