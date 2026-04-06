interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // decimal, e.g. 0.20 for 20% VAT
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface InvoiceResult {
  lines: Array<{
    subtotal: number;    // quantity * unitPrice
    discountAmount: number;
    taxableAmount: number; // subtotal - discountAmount
    taxAmount: number;
    total: number;       // taxableAmount + taxAmount
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];

  for (const item of items) {
    // Calculate subtotal: quantity * unitPrice, rounded to 2 decimals
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount: apply to subtotal
        discountAmount = Math.round((subtotal * item.discount.value) / 100 * 100) / 100;
      } else {
        // Fixed discount: use as-is
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Cap discount at subtotal to ensure taxableAmount >= 0
    discountAmount = Math.min(discountAmount, subtotal);

    // Calculate taxable amount: subtotal minus discount
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    // Calculate tax: apply tax rate to taxableAmount (not subtotal)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate total: taxableAmount + taxAmount
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });
  }

  // Sum up totals from rounded line items
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

export { calculateInvoice, type LineItem, type InvoiceResult };