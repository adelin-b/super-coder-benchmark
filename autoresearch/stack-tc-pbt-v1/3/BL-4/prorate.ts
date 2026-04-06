export function calculateProration(
  amount: number,
  usageStart: Date,
  usageEnd: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  // Validate amount
  if (typeof amount !== "number" || amount < 0) {
    throw new Error("Amount must be a non-negative number");
  }

  // Validate dates are Date instances
  if (
    !(usageStart instanceof Date) ||
    !(usageEnd instanceof Date) ||
    !(periodStart instanceof Date) ||
    !(periodEnd instanceof Date)
  ) {
    throw new Error("All date parameters must be Date instances");
  }

  // Validate usage period is valid
  if (usageStart > usageEnd) {
    throw new Error(
      "Usage start date must be before or equal to usage end date"
    );
  }

  // Validate billing period is valid
  if (periodStart > periodEnd) {
    throw new Error(
      "Period start date must be before or equal to period end date"
    );
  }

  // Validate usage period falls within billing period
  if (usageStart < periodStart) {
    throw new Error("Usage period cannot start before billing period");
  }

  if (usageEnd > periodEnd) {
    throw new Error("Usage period cannot end after billing period");
  }

  // Calculate durations in milliseconds
  const usageDuration = usageEnd.getTime() - usageStart.getTime();
  const periodDuration = periodEnd.getTime() - periodStart.getTime();

  // Validate period has duration
  if (periodDuration === 0) {
    throw new Error("Billing period must have duration greater than 0");
  }

  // Calculate prorated amount proportionally
  const proratedAmount = (usageDuration / periodDuration) * amount;

  return proratedAmount;
}