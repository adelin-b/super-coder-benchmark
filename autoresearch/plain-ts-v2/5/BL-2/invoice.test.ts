import { describe, it, expect } from 'vitest';
import { calculateInvoice, InvoiceError } from './invoice.js';

describe('BL-2: Invoice Calculator Reference', () => {
  it('basic line item', () => {
    const r = calculateInvoice([{ description: 'Widget', quantity: 2, unitPrice: 100, taxRate: 0.20 }]);
    expect(r.lines[0].subtotal).toBe(200);
    expect(r.lines[0].taxAmount).toBe(40);
    expect(r.lines[0].total).toBe(240);
    expect(r.grandTotal).toBe(240);
  });

  it('percentage discount', () => {
    const r = calculateInvoice([{ description: 'A', quantity: 1, unitPrice: 100, taxRate: 0.20, discount: { type: 'percentage', value: 10 } }]);
    expect(r.lines[0].subtotal).toBe(100);
    expect(r.lines[0].discountAmount).toBe(10);
    expect(r.lines[0].taxableAmount).toBe(90);
    expect(r.lines[0].taxAmount).toBe(18); // 20% of 90
    expect(r.lines[0].total).toBe(108);
  });

  it('fixed discount', () => {
    const r = calculateInvoice([{ description: 'A', quantity: 1, unitPrice: 100, taxRate: 0.20, discount: { type: 'fixed', value: 25 } }]);
    expect(r.lines[0].taxableAmount).toBe(75);
    expect(r.lines[0].taxAmount).toBe(15);
    expect(r.lines[0].total).toBe(90);
  });

  it('fixed discount capped at subtotal', () => {
    const r = calculateInvoice([{ description: 'A', quantity: 1, unitPrice: 50, taxRate: 0.10, discount: { type: 'fixed', value: 100 } }]);
    expect(r.lines[0].taxableAmount).toBe(0);
    expect(r.lines[0].total).toBe(0);
  });

  it('multiple items', () => {
    const r = calculateInvoice([
      { description: 'A', quantity: 2, unitPrice: 50, taxRate: 0.20 },
      { description: 'B', quantity: 1, unitPrice: 200, taxRate: 0.10 },
    ]);
    expect(r.grandTotal).toBe(r.lines[0].total + r.lines[1].total);
  });

  it('INV1: grandTotal === sum of line totals', () => {
    const r = calculateInvoice([
      { description: 'A', quantity: 3, unitPrice: 33.33, taxRate: 0.20 },
      { description: 'B', quantity: 7, unitPrice: 11.11, taxRate: 0.10, discount: { type: 'percentage', value: 5 } },
    ]);
    const sum = r.lines.reduce((s, l) => s + l.total, 0);
    expect(r.grandTotal).toBeCloseTo(sum, 1);
  });

  it('INV3: taxableAmount >= 0', () => {
    const r = calculateInvoice([
      { description: 'A', quantity: 1, unitPrice: 10, taxRate: 0.20, discount: { type: 'percentage', value: 100 } },
    ]);
    expect(r.lines[0].taxableAmount).toBeGreaterThanOrEqual(0);
  });

  it('throws on percentage discount > 100%', () => {
    expect(() => calculateInvoice([{ description: 'A', quantity: 1, unitPrice: 100, taxRate: 0.20, discount: { type: 'percentage', value: 150 } }])).toThrow(InvoiceError);
  });

  it('throws on empty items', () => {
    expect(() => calculateInvoice([])).toThrow(InvoiceError);
  });

  it('throws on negative quantity', () => {
    expect(() => calculateInvoice([{ description: 'A', quantity: -1, unitPrice: 100, taxRate: 0.20 }])).toThrow(InvoiceError);
  });
});
