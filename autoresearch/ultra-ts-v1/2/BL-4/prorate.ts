export interface ProrationResult {
  prorated: number;
  ratio: number;
  daysUsed: number;
  totalDays: number;
}

export function prorate(
  charge: number,
  periodStart: Date,
  periodEnd: Date,
  usageStart: Date,
  usageEnd: Date
): ProrationResult {
  if (charge < 0) throw new Error("charge must be non-negative");
  if (periodStart >= periodEnd) throw new Error("periodStart must be before periodEnd");
  if (usageStart >= usageEnd) throw new Error("usageStart must be before usageEnd");

  const effectiveStart = new Date(Math.max(periodStart.getTime(), usageStart.getTime()));
  const effectiveEnd = new Date(Math.min(periodEnd.getTime(), usageEnd.getTime()));

  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const usedMs = Math.max(0, effectiveEnd.getTime() - effectiveStart.getTime());

  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const daysUsed = Math.ceil(usedMs / (1000 * 60 * 60 * 24));
  const ratio = usedMs / totalMs;
  const prorated = Math.round(charge * ratio * 100) / 100;

  return {
    prorated,
    ratio,
    daysUsed,
    totalDays
  };
}

export function prorateByDays(
  charge: number,
  totalDays: number,
  usedDays: number
): ProrationResult {
  if (charge < 0) throw new Error("charge must be non-negative");
  if (totalDays <= 0) throw new Error("totalDays must be positive");
  if (usedDays < 0) throw new Error("usedDays must be non-negative");
  if (usedDays > totalDays) throw new Error("usedDays cannot exceed totalDays");

  const ratio = usedDays / totalDays;
  const prorated = Math.round(charge * ratio * 100) / 100;

  return {
    prorated,
    ratio,
    daysUsed: usedDays,
    totalDays
  };
}