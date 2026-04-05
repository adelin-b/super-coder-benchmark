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

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
    };
  }

  const lines = items.map((item) => {
    const { quantity, unitPrice, taxRate, discount } = item;

    // Invariant: quantity and unitPrice should be treated as-is (could be negative for credit notes)
    const subtotal = roundToCents(quantity * unitPrice);

    // Calculate discount amount — fix bug #2 (cap) and bug #4 (sign)
    let discountAmount = 0;
    if (discount) {
      if (discount.type === 'percentage') {
        // Fix bug #2: clamp percentage to [0, 100] so taxableAmount can't go negative
        const clampedPct = Math.min(Math.max(discount.value, 0), 100);
        discountAmount = roundToCents(subtotal * (clampedPct / 100));
      } else {
        // fixed — fix bug #4: discount is subtracted, so discountAmount is positive
        discountAmount = roundToCents(discount.value);
      }
    }

    // Invariant #3: taxableAmount >= 0
    // Cap discountAmount so it doesn't exceed a positive subtotal
    const cappedDiscount =
      subtotal >= 0
        ? Math.min(discountAmount, subtotal)
        : Math.max(discountAmount, subtotal);
    const taxableAmount = roundToCents(subtotal - cappedDiscount);

    // Fix bug #1: tax applied to taxableAmount, not subtotal
    const taxAmount = roundToCents(taxableAmount * taxRate);

    // Fix bug #3: round per-line
    const total = roundToCents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount: cappedDiscount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  const subtotal = roundToCents(lines.reduce((sum, l) => sum + l.subtotal, 0));
  const totalDiscount = roundToCents(lines.reduce((sum, l) => sum + l.discountAmount, 0));
  const totalTax = roundToCents(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  // Invariant #1: grandTotal === sum of line totals
  const grandTotal = roundToCents(lines.reduce((sum, l) => sum + l.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}