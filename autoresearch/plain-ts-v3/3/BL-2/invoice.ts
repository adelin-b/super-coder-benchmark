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

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
    // Calculate subtotal (quantity * unitPrice), rounded to cents
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount based on type
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Cap discount to not exceed subtotal (prevents negative taxableAmount)
    discountAmount = Math.min(discountAmount, subtotal);

    // Calculate taxable amount (subtotal - discount), rounded to cents
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxableAmount (not on subtotal), rounded to cents
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total (taxableAmount + taxAmount), rounded to cents
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    // Accumulate totals from rounded line items
    totalSubtotal += subtotal;
    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
    grandTotal += total;
  }

  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscountAmount),
    totalTax: round(totalTaxAmount),
    grandTotal: round(grandTotal),
  };
}

export { calculateInvoice, type LineItem, type InvoiceResult };