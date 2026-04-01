/** BUG: Apply tax to subtotal instead of taxableAmount (over-taxes when discount present) */
export interface LineItem { description: string; quantity: number; unitPrice: number; taxRate: number; discount?: { type: 'percentage' | 'fixed'; value: number }; }
export interface LineResult { subtotal: number; discountAmount: number; taxableAmount: number; taxAmount: number; total: number; }
export interface InvoiceResult { lines: LineResult[]; subtotal: number; totalDiscount: number; totalTax: number; grandTotal: number; }
export class InvoiceError extends Error { constructor(m: string) { super(m); this.name = 'InvoiceError'; } }
function r2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) throw new InvoiceError('items required');
  const lines: LineResult[] = items.map((item, i) => {
    if (item.quantity < 0) throw new InvoiceError(`Item ${i}: negative quantity`);
    if (item.unitPrice < 0) throw new InvoiceError(`Item ${i}: negative unit price`);
    if (item.taxRate < 0) throw new InvoiceError(`Item ${i}: negative tax rate`);
    const subtotal = r2(item.quantity * item.unitPrice);
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.value < 0) throw new InvoiceError(`Item ${i}: negative discount`);
      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) throw new InvoiceError(`Item ${i}: discount > 100%`);
        discountAmount = r2(subtotal * item.discount.value / 100);
      } else {
        discountAmount = r2(Math.min(item.discount.value, subtotal));
      }
    }
    const taxableAmount = r2(subtotal - discountAmount);
    const taxAmount = r2(subtotal * item.taxRate); // BUG: tax on subtotal, not taxableAmount
    const total = r2(taxableAmount + taxAmount);
    return { subtotal, discountAmount, taxableAmount, taxAmount, total };
  });
  return { lines, subtotal: r2(lines.reduce((s,l)=>s+l.subtotal,0)), totalDiscount: r2(lines.reduce((s,l)=>s+l.discountAmount,0)), totalTax: r2(lines.reduce((s,l)=>s+l.taxAmount,0)), grandTotal: r2(lines.reduce((s,l)=>s+l.total,0)) };
}
