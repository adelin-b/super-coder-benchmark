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
  let totalGrandTotal = 0;

  for (const item of items) {
    // Calculate subtotal, rounded to 2 decimals
    let subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    totalSubtotal += subtotal;

    // Calculate discount amount, rounded to 2 decimals
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = Math.round(subtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Ensure discount doesn't exceed subtotal (avoid negative taxableAmount)
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    totalDiscountAmount += discountAmount;

    // Calculate taxable amount (subtotal minus discount), rounded to 2 decimals
    let taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    if (taxableAmount < 0) {
      taxableAmount = 0;
    }

    // Calculate tax amount on taxableAmount (not subtotal), rounded to 2 decimals
    let taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;
    totalTaxAmount += taxAmount;

    // Calculate line total, rounded to 2 decimals
    let lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;
    totalGrandTotal += lineTotal;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal
    });
  }

  return {
    lines,
    subtotal: Math.round(totalSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscountAmount * 100) / 100,
    totalTax: Math.round(totalTaxAmount * 100) / 100,
    grandTotal: Math.round(totalGrandTotal * 100) / 100
  };
}

export { calculateInvoice, LineItem, InvoiceResult };