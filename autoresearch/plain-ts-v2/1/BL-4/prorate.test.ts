import { describe, it, expect } from 'vitest';
import { calculateProration, ProrateError } from './prorate.js';

describe('BL-4: Proration', () => {
  it('full month = full amount', () => {
    const r = calculateProration({ totalAmount: 100, startDate: '2026-01-01', endDate: '2026-01-31', billingStart: '2026-01-01', billingEnd: '2026-01-31' });
    expect(r.proratedAmount).toBe(100);
    expect(r.ratio).toBe(1);
  });
  it('half month', () => {
    const r = calculateProration({ totalAmount: 100, startDate: '2026-01-16', endDate: '2026-01-31', billingStart: '2026-01-01', billingEnd: '2026-01-31' });
    expect(r.daysUsed).toBe(15);
    expect(r.proratedAmount).toBe(50);
  });
  it('start before billing period clamped', () => {
    const r = calculateProration({ totalAmount: 300, startDate: '2025-12-15', endDate: '2026-01-31', billingStart: '2026-01-01', billingEnd: '2026-01-31' });
    expect(r.daysUsed).toBe(30);
  });
  it('zero days = zero amount', () => {
    const r = calculateProration({ totalAmount: 100, startDate: '2026-02-01', endDate: '2026-02-01', billingStart: '2026-01-01', billingEnd: '2026-01-31' });
    expect(r.proratedAmount).toBe(0);
  });
  it('throws on negative amount', () => {
    expect(() => calculateProration({ totalAmount: -1, startDate: '2026-01-01', endDate: '2026-01-31', billingStart: '2026-01-01', billingEnd: '2026-01-31' })).toThrow(ProrateError);
  });
  it('throws on invalid billing range', () => {
    expect(() => calculateProration({ totalAmount: 100, startDate: '2026-01-01', endDate: '2026-01-31', billingStart: '2026-01-31', billingEnd: '2026-01-01' })).toThrow(ProrateError);
  });
});
