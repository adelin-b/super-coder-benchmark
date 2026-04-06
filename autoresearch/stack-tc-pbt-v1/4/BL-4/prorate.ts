export function calculateProration(
  chargeAmount: number,
  periodStartDate: Date,
  periodEndDate: Date,
  usageStartDate: Date,
  usageEndDate: Date
): number {
  if (chargeAmount < 0) {
    throw new Error("Charge amount cannot be negative")
  }

  const periodStart = new Date(periodStartDate)
  const periodEnd = new Date(periodEndDate)
  const usageStart = new Date(usageStartDate)
  const usageEnd = new Date(usageEndDate)

  if (periodStart > periodEnd) {
    throw new Error("Period start date must be before or equal to period end date")
  }

  if (usageStart > usageEnd) {
    throw new Error("Usage start date must be before or equal to usage end date")
  }

  // Calculate overlap between billing period and usage period
  const overlapStart = usageStart > periodStart ? usageStart : periodStart
  const overlapEnd = usageEnd < periodEnd ? usageEnd : periodEnd

  // If there's no overlap, charge is 0
  if (overlapStart > overlapEnd) {
    return 0
  }

  // Calculate total days in billing period (inclusive)
  const totalDays = getDaysBetween(periodStart, periodEnd) + 1

  // Calculate days in usage period (inclusive)
  const usageDays = getDaysBetween(overlapStart, overlapEnd) + 1

  // Return prorated amount
  return (chargeAmount * usageDays) / totalDays
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Reset time to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - start.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  return Math.floor(diffDays)
}

export function calculateDailyRate(chargeAmount: number, daysInPeriod: number): number {
  if (chargeAmount < 0) {
    throw new Error("Charge amount cannot be negative")
  }

  if (daysInPeriod <= 0) {
    throw new Error("Days in period must be positive")
  }

  return chargeAmount / daysInPeriod
}

export function prorateByDays(
  chargeAmount: number,
  daysUsed: number,
  daysInPeriod: number
): number {
  if (chargeAmount < 0) {
    throw new Error("Charge amount cannot be negative")
  }

  if (daysUsed < 0) {
    throw new Error("Days used cannot be negative")
  }

  if (daysInPeriod <= 0) {
    throw new Error("Days in period must be positive")
  }

  if (daysUsed > daysInPeriod) {
    throw new Error("Days used cannot exceed days in period")
  }

  return (chargeAmount * daysUsed) / daysInPeriod
}