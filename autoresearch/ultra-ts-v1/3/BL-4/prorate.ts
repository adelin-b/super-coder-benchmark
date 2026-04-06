export class ProrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProrateError';
  }
}

interface ProrateInput {
  totalAmount: number;
  startDate: string;
  endDate: string;
  billingStart: string;
  billingEnd: string;
}

interface ProrateResult {
  proratedAmount: number;
  ratio: number;
  daysUsed: number;
}

export function calculateProration(input: ProrateInput): ProrateResult {
  const { totalAmount, startDate, endDate, billingStart, billingEnd } = input;

  // Validation
  if (totalAmount < 0) {
    throw new ProrateError('Total amount cannot be negative');
  }

  const billingStartDate = new Date(billingStart);
  const billingEndDate = new Date(billingEnd);

  if (billingStartDate > billingEndDate) {
    throw new ProrateError('Billing start date must be before or equal to billing end date');
  }

  const serviceStartDate = new Date(startDate);
  const serviceEndDate = new Date(endDate);

  // Clamp service start to billing start
  const effectiveStartDate = serviceStartDate < billingStartDate ? billingStartDate : serviceStartDate;

  // If service ends before/at effective start, no days used
  if (serviceEndDate <= effectiveStartDate) {
    return {
      proratedAmount: 0,
      ratio: 0,
      daysUsed: 0
    };
  }

  // Calculate days used (difference in days, not inclusive of start day)
  const daysUsed = Math.floor((serviceEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate total billing days
  const totalBillingDays = Math.floor((billingEndDate.getTime() - billingStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate ratio and prorated amount
  const ratio = totalBillingDays > 0 ? daysUsed / totalBillingDays : 0;
  const proratedAmount = Math.round(totalAmount * ratio * 100) / 100;

  return {
    proratedAmount,
    ratio,
    daysUsed
  };
}