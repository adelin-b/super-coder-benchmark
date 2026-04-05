/** BUG: No per-line rounding — accumulates floating point errors across lines */
export interface LineItem { description: string; quantity: number; unitPrice: number; taxRate: number; discount?: { type: 'percentage' | 'fixed'; value: number }; }
export interface LineResult { subtotal: number; discountAmount: number; taxableAmount: number; taxAmount: number; total: number; }
export interface InvoiceResult { lines: LineResult[]; subtotal: number; totalDiscount: number; totalTax: number; grandTotal: number; }
export class InvoiceError extends Error { constructor(m: string) { super(m); this.name = 'InvoiceError'; } }

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) throw new InvoiceError('items required');
  const lines: LineResult[] = items.map((item, i) => {
    if (item.quantity < 0) throw new InvoiceError(`Item ${i}: negative quantity`);
    if (item.unitPrice < 0) throw new InvoiceError(`Item ${i}: negative unit price`);
    if (item.taxRate < 0) throw new InvoiceError(`Item ${i}: negative tax rate`);
    const subtotal = item.quantity * item.unitPrice; // BUG: no r2
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.value < 0) throw new InvoiceError(`Item ${i}: negative discount`);
      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) throw new InvoiceError(`Item ${i}: discount > 100%`);
        discountAmount = subtotal * item.discount.value / 100; // BUG: no r2
      } else {
        discountAmount = Math.min(item.discount.value, subtotal);
      }
    }
    const taxableAmount = subtotal - discountAmount; // BUG: no r2
    const taxAmount = taxableAmount * item.taxRate; // BUG: no r2
    const total = taxableAmount + taxAmount; // BUG: no r2
    return { subtotal, discountAmount, taxableAmount, taxAmount, total };
  });
  return { lines, subtotal: lines.reduce((s,l)=>s+l.subtotal,0), totalDiscount: lines.reduce((s,l)=>s+l.discountAmount,0), totalTax: lines.reduce((s,l)=>s+l.taxAmount,0), grandTotal: lines.reduce((s,l)=>s+l.total,0) };
}
