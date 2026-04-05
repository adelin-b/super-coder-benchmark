export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

export interface InvoiceResult {
  lines: Array<{
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = items.map((item) => {
    const subtotal = round2(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Clamp percentage to [0, 100] to prevent taxableAmount going negative
        const clampedPct = Math.min(Math.max(item.discount.value, 0), 100);
        discountAmount = round2(subtotal * (clampedPct / 100));
      } else {
        // Fixed discount: subtract (not add), clamp to subtotal so taxableAmount >= 0
        const clampedFixed = Math.min(Math.max(item.discount.value, 0), subtotal);
        discountAmount = round2(clampedFixed);
      }
    }

    // taxableAmount must be >= 0
    const taxableAmount = round2(Math.max(subtotal - discountAmount, 0));

    // Tax is applied to taxableAmount (after discount), not subtotal
    const taxAmount = round2(taxableAmount * item.taxRate);

    const total = round2(taxableAmount + taxAmount);

    return { subtotal, discountAmount, taxableAmount, taxAmount, total };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
  const totalDiscount = round2(lines.reduce((sum, l) => sum + l.discountAmount, 0));
  const totalTax = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  const grandTotal = round2(lines.reduce((sum, l) => sum + l.total, 0));

  return { lines, subtotal, totalDiscount, totalTax, grandTotal };
}