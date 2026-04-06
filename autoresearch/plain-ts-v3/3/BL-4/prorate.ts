export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

export function prorateCharge(
  amount: number,
  startDate: Date,
  endDate: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  if (!Number.isFinite(amount)) {
    throw new ProrateError('Amount must be a finite number');
  }
  
  if (amount < 0) {
    throw new ProrateError('Amount cannot be negative');
  }
  
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new ProrateError('startDate and endDate must be Date objects');
  }
  
  if (!(periodStart instanceof Date) || !(periodEnd instanceof Date)) {
    throw new ProrateError('periodStart and periodEnd must be Date objects');
  }
  
  if (startDate > endDate) {
    throw new ProrateError('startDate cannot be after endDate');
  }
  
  if (periodStart > periodEnd) {
    throw new ProrateError('periodStart cannot be after periodEnd');
  }
  
  // Calculate overlap between charge period and billing period
  const overlapStart = new Date(Math.max(startDate.getTime(), periodStart.getTime()));
  const overlapEnd = new Date(Math.min(endDate.getTime(), periodEnd.getTime()));
  
  // If there's no overlap, return 0
  if (overlapStart >= overlapEnd) {
    return 0;
  }
  
  // Calculate milliseconds in overlap and total charge period
  const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
  const totalMs = endDate.getTime() - startDate.getTime();
  
  // Return prorated amount
  return (overlapMs / totalMs) * amount;
}

export function prorateChargeByDays(
  amount: number,
  chargeStartDay: number,
  chargeEndDay: number,
  periodStartDay: number,
  periodEndDay: number,
  daysInPeriod: number
): number {
  if (!Number.isFinite(amount)) {
    throw new ProrateError('Amount must be a finite number');
  }
  
  if (amount < 0) {
    throw new ProrateError('Amount cannot be negative');
  }
  
  if (chargeStartDay > chargeEndDay) {
    throw new ProrateError('chargeStartDay cannot be after chargeEndDay');
  }
  
  if (periodStartDay > periodEndDay) {
    throw new ProrateError('periodStartDay cannot be after periodEndDay');
  }
  
  if (daysInPeriod <= 0) {
    throw new ProrateError('daysInPeriod must be positive');
  }
  
  // Calculate overlap in days
  const overlapStart = Math.max(chargeStartDay, periodStartDay);
  const overlapEnd = Math.min(chargeEndDay, periodEndDay);
  
  if (overlapStart >= overlapEnd) {
    return 0;
  }
  
  const overlapDays = overlapEnd - overlapStart;
  const chargeDays = chargeEndDay - chargeStartDay;
  
  return (overlapDays / chargeDays) * amount;
}