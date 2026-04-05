export interface BillingPeriod {
  start: Date;
  end: Date;
}

export interface UsagePeriod {
  start: Date;
  end: Date;
}

export interface ProratedChargeResult {
  charge: number;
  daysUsed: number;
  totalDays: number;
  ratio: number;
}

export function prorateCharge(
  totalCharge: number,
  billingPeriod: BillingPeriod,
  usagePeriod: UsagePeriod
): ProratedChargeResult {
  // Validate charge
  if (totalCharge < 0) {
    throw new Error('Charge cannot be negative');
  }

  // Validate billing period
  if (billingPeriod.start >= billingPeriod.end) {
    throw new Error('Billing period start must be before end date');
  }

  // Validate usage period
  if (usagePeriod.start >= usagePeriod.end) {
    throw new Error('Usage period start must be before end date');
  }

  // Clamp usage period to billing period
  const effectiveStart =
    usagePeriod.start < billingPeriod.start
      ? billingPeriod.start
      : usagePeriod.start;

  const effectiveEnd =
    usagePeriod.end > billingPeriod.end
      ? billingPeriod.end
      : usagePeriod.end;

  // Calculate total days in billing period
  const totalMs = billingPeriod.end.getTime() - billingPeriod.start.getTime();
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));

  if (totalDays <= 0) {
    throw new Error('Billing period must span at least one day');
  }

  // Calculate days used in usage period
  const usedMs = effectiveEnd.getTime() - effectiveStart.getTime();
  const daysUsed = Math.ceil(usedMs / (1000 * 60 * 60 * 24));

  // Calculate proration ratio and prorated charge
  const ratio = Math.max(0, Math.min(1, daysUsed / totalDays));
  const proratedCharge = totalCharge * ratio;

  return {
    charge: proratedCharge,
    daysUsed: Math.max(0, daysUsed),
    totalDays,
    ratio,
  };
}

export function prorateByDays(
  totalCharge: number,
  totalDays: number,
  usedDays: number
): ProratedChargeResult {
  // Validate inputs
  if (totalCharge < 0) {
    throw new Error('Charge cannot be negative');
  }

  if (totalDays <= 0) {
    throw new Error('Total days must be positive');
  }

  if (usedDays < 0) {
    throw new Error('Used days cannot be negative');
  }

  // Clamp used days to total days
  const clampedUsedDays = Math.min(usedDays, totalDays);

  // Calculate ratio and prorated charge
  const ratio = clampedUsedDays / totalDays;
  const proratedCharge = totalCharge * ratio;

  return {
    charge: proratedCharge,
    daysUsed: clampedUsedDays,
    totalDays,
    ratio,
  };
}