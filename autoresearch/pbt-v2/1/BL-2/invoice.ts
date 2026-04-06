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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate line subtotal
    const lineSubtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(lineSubtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Calculate taxable amount
    const taxableAmount = round(lineSubtotal - discountAmount);

    // Validate that discount doesn't exceed subtotal
    if (taxableAmount < 0) {
      throw new Error('Discount cannot exceed subtotal');
    }

    // Calculate tax on taxableAmount (not subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total
    const lineTotal = round(taxableAmount + taxAmount);

    // Add to totals
    subtotal = round(subtotal + lineSubtotal);
    totalDiscount = round(totalDiscount + discountAmount);
    totalTax = round(totalTax + taxAmount);
    grandTotal = round(grandTotal + lineTotal);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });
  }

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice, type LineItem, type InvoiceResult };