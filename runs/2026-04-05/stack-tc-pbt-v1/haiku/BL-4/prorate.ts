export interface ProrationResult {
  amount: number
  daysUsed: number
  daysInPeriod: number
  dailyRate: number
}

/**
 * Calculates the prorated amount for a date range within a billing period.
 * 
 * @param amount - Total charge for the billing period
 * @param usageStart - Start date of the usage period
 * @param usageEnd - End date of the usage period
 * @param periodStart - Start date of the billing period
 * @param periodEnd - End date of the billing period
 * @returns ProrationResult with the prorated amount and calculation details
 * @throws Error if dates are invalid or periods don't overlap
 */
export function prorateCharge(
  amount: number,
  usageStart: Date,
  usageEnd: Date,
  periodStart: Date,
  periodEnd: Date
): ProrationResult {
  if (amount < 0) {
    throw new Error("Amount must be non-negative")
  }

  const start = new Date(usageStart)
  const end = new Date(usageEnd)
  const pStart = new Date(periodStart)
  const pEnd = new Date(periodEnd)

  if (start > end) {
    throw new Error("Usage start date must be before or equal to usage end date")
  }

  if (pStart > pEnd) {
    throw new Error("Period start date must be before or equal to period end date")
  }

  // Clamp usage dates to billing period
  const clampedStart = new Date(Math.max(start.getTime(), pStart.getTime()))
  const clampedEnd = new Date(Math.min(end.getTime(), pEnd.getTime()))

  // If no overlap, return zero
  if (clampedStart > clampedEnd) {
    return {
      amount: 0,
      daysUsed: 0,
      daysInPeriod: daysBetween(pStart, pEnd),
      dailyRate: amount / daysBetween(pStart, pEnd),
    }
  }

  const daysInPeriod = daysBetween(pStart, pEnd)
  const daysUsed = daysBetween(clampedStart, clampedEnd)
  const dailyRate = amount / daysInPeriod

  return {
    amount: Math.round(dailyRate * daysUsed * 100) / 100,
    daysUsed,
    daysInPeriod,
    dailyRate,
  }
}

/**
 * Calculates prorated amount based on daily rate and days used.
 * 
 * @param dailyRate - Cost per day
 * @param daysUsed - Number of days used
 * @returns Prorated amount
 * @throws Error if inputs are negative
 */
export function prorateDaily(dailyRate: number, daysUsed: number): number {
  if (dailyRate < 0) {
    throw new Error("Daily rate must be non-negative")
  }

  if (daysUsed < 0) {
    throw new Error("Days used must be non-negative")
  }

  return Math.round(dailyRate * daysUsed * 100) / 100
}

/**
 * Helper: Calculate the number of days between two dates (inclusive of both endpoints).
 * @internal
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
}

export type { ProrationResult }