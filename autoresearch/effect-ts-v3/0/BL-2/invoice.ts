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
    // Subtotal: quantity × unitPrice
    const subtotal = roundToCents(item.quantity * item.unitPrice);

    // Discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = subtotal * (item.discount.value / 100);
      } else {
        discountAmount = item.discount.value;
      }
    }
    discountAmount = roundToCents(discountAmount);

    // Taxable amount: subtotal - discount (but never negative)
    let taxableAmount = subtotal - discountAmount;
    taxableAmount = roundToCents(Math.max(0, taxableAmount));

    // Tax amount: taxableAmount × taxRate
    const taxAmount = roundToCents(taxableAmount * item.taxRate);

    // Total: taxableAmount + taxAmount
    const total = roundToCents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  // Aggregate totals
  const subtotal = roundToCents(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = roundToCents(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const totalTax = roundToCents(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = roundToCents(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice, LineItem, InvoiceResult };