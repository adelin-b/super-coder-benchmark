export function prorateByDays(
  amount: number,
  daysUsed: number,
  totalDays: number
): number {
  if (amount < 0) {
    throw new Error("Amount must be non-negative");
  }
  if (daysUsed < 0) {
    throw new Error("Days used must be non-negative");
  }
  if (totalDays <= 0) {
    throw new Error("Total days must be positive");
  }
  if (daysUsed > totalDays) {
    throw new Error("Days used cannot exceed total days");
  }

  return (amount * daysUsed) / totalDays;
}

export function prorateByDate(
  amount: number,
  usageStart: Date,
  usageEnd: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  if (amount < 0) {
    throw new Error("Amount must be non-negative");
  }
  if (usageStart > usageEnd) {
    throw new Error("Usage start date must be before or equal to usage end date");
  }
  if (periodStart > periodEnd) {
    throw new Error("Period start date must be before or equal to period end date");
  }

  const overlapStart = new Date(
    Math.max(usageStart.getTime(), periodStart.getTime())
  );
  const overlapEnd = new Date(Math.min(usageEnd.getTime(), periodEnd.getTime()));

  if (overlapStart > overlapEnd) {
    return 0;
  }

  const daysUsed =
    (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24);
  const totalDays =
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

  if (totalDays === 0) {
    throw new Error("Period must have positive duration");
  }

  return (amount * daysUsed) / totalDays;
}

export function splitChargeOnRateChange(
  amount: number,
  daysAtOldRate: number,
  daysAtNewRate: number
): [number, number] {
  const totalDays = daysAtOldRate + daysAtNewRate;

  if (amount < 0) {
    throw new Error("Amount must be non-negative");
  }
  if (daysAtOldRate < 0) {
    throw new Error("Days at old rate must be non-negative");
  }
  if (daysAtNewRate < 0) {
    throw new Error("Days at new rate must be non-negative");
  }
  if (totalDays === 0) {
    throw new Error("Total days must be positive");
  }

  const chargeAtOldRate = (amount * daysAtOldRate) / totalDays;
  const chargeAtNewRate = (amount * daysAtNewRate) / totalDays;

  return [chargeAtOldRate, chargeAtNewRate];
}

export function remainingProration(
  monthlyAmount: number,
  daysPassed: number,
  daysInMonth: number
): number {
  if (monthlyAmount < 0) {
    throw new Error("Monthly amount must be non-negative");
  }
  if (daysPassed < 0) {
    throw new Error("Days passed must be non-negative");
  }
  if (daysInMonth <= 0) {
    throw new Error("Days in month must be positive");
  }
  if (daysPassed > daysInMonth) {
    throw new Error("Days passed cannot exceed days in month");
  }

  const daysRemaining = daysInMonth - daysPassed;
  return (monthlyAmount * daysRemaining) / daysInMonth;
}