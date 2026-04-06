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

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];

  for (const item of items) {
    // Calculate subtotal with rounding to cents
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount based on type
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = Math.round((subtotal * item.discount.value) / 100 * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Calculate taxable amount, ensuring it never goes negative
    const taxableAmount = Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100;

    // Apply tax to taxableAmount (not subtotal)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });
  }

  // Calculate aggregate totals
  const subtotal = Math.round(
    lines.reduce((sum, line) => sum + line.subtotal, 0) * 100
  ) / 100;
  const totalDiscount = Math.round(
    lines.reduce((sum, line) => sum + line.discountAmount, 0) * 100
  ) / 100;
  const totalTax = Math.round(
    lines.reduce((sum, line) => sum + line.taxAmount, 0) * 100
  ) / 100;
  const grandTotal = Math.round(
    lines.reduce((sum, line) => sum + line.total, 0) * 100
  ) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice, LineItem, InvoiceResult };