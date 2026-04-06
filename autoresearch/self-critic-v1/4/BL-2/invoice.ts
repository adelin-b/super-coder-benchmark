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
  const lines: Array<{
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }> = [];

  let totalSubtotal = 0;
  let totalDiscountAmount = 0;
  let totalTaxAmount = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal: quantity * unitPrice, rounded to 2 decimals
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount based on type
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount: subtotal * (discount% / 100)
        discountAmount = Math.round(subtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        // Fixed discount: use value as-is
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Taxable amount: subtotal - discountAmount, clamped to >= 0
    const taxableAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Tax amount: calculated on taxableAmount, NOT subtotal
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Line total: taxableAmount + taxAmount
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    // Accumulate totals
    totalSubtotal += subtotal;
    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
    grandTotal += total;
  }

  // Round final totals to 2 decimal places
  const result: InvoiceResult = {
    lines,
    subtotal: Math.round(totalSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscountAmount * 100) / 100,
    totalTax: Math.round(totalTaxAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };

  return result;
}

export { calculateInvoice, LineItem, InvoiceResult };