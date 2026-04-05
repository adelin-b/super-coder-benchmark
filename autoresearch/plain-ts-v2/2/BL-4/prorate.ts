export interface ProrationResult {
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  daysUsed: number;
  totalDays: number;
}

export class ProrateCalculator {
  calculateProration(
    amount: number,
    startDate: Date,
    endDate: Date,
    periodStart: Date,
    periodEnd: Date
  ): number {
    if (amount < 0) {
      throw new Error('Amount must be non-negative');
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    if (periodStart > periodEnd) {
      throw new Error('Period start must be before or equal to period end');
    }

    // Clamp usage dates to period boundaries
    const usageStart = startDate < periodStart ? periodStart : startDate;
    const usageEnd = endDate > periodEnd ? periodEnd : endDate;

    // If no overlap, return 0
    if (usageStart > usageEnd) {
      return 0;
    }

    // Calculate day counts (inclusive of both endpoints, so add 1)
    const daysUsed =
      Math.floor((usageEnd.getTime() - usageStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays =
      Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) {
      throw new Error('Invalid period: end date must be after start date');
    }

    return (amount * daysUsed) / totalDays;
  }

  splitCharge(
    charge: number,
    usageStart: Date,
    usageEnd: Date,
    periods: Array<{ start: Date; end: Date }>
  ): ProrationResult[] {
    if (charge < 0) {
      throw new Error('Charge must be non-negative');
    }

    if (usageStart > usageEnd) {
      throw new Error('Usage start date must be before or equal to usage end date');
    }

    if (!periods || periods.length === 0) {
      throw new Error('At least one period must be provided');
    }

    const results: ProrationResult[] = [];

    for (const period of periods) {
      if (period.start > period.end) {
        throw new Error('Period start must be before or equal to period end');
      }

      // Check if usage overlaps with this period
      if (usageEnd < period.start || usageStart > period.end) {
        continue;
      }

      const overlapStart = usageStart > period.start ? usageStart : period.start;
      const overlapEnd = usageEnd < period.end ? usageEnd : period.end;

      const daysUsed =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays =
        Math.floor((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (totalDays <= 0) {
        continue;
      }

      const amount = (charge * daysUsed) / totalDays;

      results.push({
        periodStart: period.start,
        periodEnd: period.end,
        amount,
        daysUsed,
        totalDays,
      });
    }

    return results;
  }
}

export function createProrationCalculator(): ProrateCalculator {
  return new ProrateCalculator();
}