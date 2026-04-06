export function calculateDailyRate(chargeAmount: number, daysInPeriod: number): number {
  if (daysInPeriod <= 0) throw new Error("daysInPeriod must be positive");
  if (chargeAmount < 0) throw new Error("chargeAmount must be non-negative");
  return chargeAmount / daysInPeriod;
}

export function prorateCharge(chargeAmount: number, daysInPeriod: number, daysUsed: number): number {
  if (daysInPeriod <= 0) throw new Error("daysInPeriod must be positive");
  if (daysUsed < 0 || daysUsed > daysInPeriod) throw new Error("daysUsed must be between 0 and daysInPeriod");
  if (chargeAmount < 0) throw new Error("chargeAmount must be non-negative");
  
  const dailyRate = chargeAmount / daysInPeriod;
  return dailyRate * daysUsed;
}

export function splitCharge(chargeAmount: number, periodDays: number[]): number[] {
  if (periodDays.length === 0) throw new Error("periodDays must not be empty");
  if (chargeAmount < 0) throw new Error("chargeAmount must be non-negative");
  
  const totalDays = periodDays.reduce((sum, days) => sum + days, 0);
  if (totalDays <= 0) throw new Error("total days must be positive");
  
  return periodDays.map(days => (days / totalDays) * chargeAmount);
}

export function prorateByDateRange(chargeAmount: number, periodStartDate: Date, periodEndDate: Date, usageStartDate: Date, usageEndDate: Date): number {
  if (chargeAmount < 0) throw new Error("chargeAmount must be non-negative");
  if (periodStartDate >= periodEndDate) throw new Error("periodStartDate must be before periodEndDate");
  if (usageStartDate >= usageEndDate) throw new Error("usageStartDate must be before usageEndDate");
  if (usageStartDate < periodStartDate || usageEndDate > periodEndDate) throw new Error("usage dates must be within period dates");
  
  const totalDays = (periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24);
  const usedDays = (usageEndDate.getTime() - usageStartDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return (usedDays / totalDays) * chargeAmount;
}