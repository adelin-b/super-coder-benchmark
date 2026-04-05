interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface InvoiceResult {
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

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines = items.map(item => {
    // Calculate subtotal
    const subtotal = roundToCents(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Clamp percentage to [0, 1]
        const clampedPercentage = Math.max(0, Math.min(1, item.discount.value));
        discountAmount = roundToCents(subtotal * clampedPercentage);
      } else if (item.discount.type === 'fixed') {
        // Cap fixed discount at subtotal
        discountAmount = roundToCents(Math.max(0, Math.min(item.discount.value, subtotal)));
      }
    }

    // Calculate taxable amount
    const taxableAmount = roundToCents(subtotal - discountAmount);

    // Calculate tax (on taxableAmount, not subtotal)
    const taxAmount = roundToCents(taxableAmount * item.taxRate);

    // Calculate total
    const total = roundToCents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  // Aggregate
  const subtotal = roundToCents(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = roundToCents(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const totalTax = roundToCents(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = roundToCents(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, type LineItem, type InvoiceResult };