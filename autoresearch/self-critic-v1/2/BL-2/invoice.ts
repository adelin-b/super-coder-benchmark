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
    totalSubtotal += subtotal;

    // Calculate requested discount amount based on type
    let requestedDiscount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        requestedDiscount = Math.round(subtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        requestedDiscount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Clamp discount so it doesn't exceed subtotal (invariant: taxableAmount >= 0)
    const discountAmount = Math.min(requestedDiscount, subtotal);
    totalDiscountAmount += discountAmount;

    // Calculate taxable amount: subtotal - discount, rounded to 2 decimals
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    // Calculate tax amount: tax applied to taxableAmount (not subtotal), rounded to 2 decimals
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;
    totalTaxAmount += taxAmount;

    // Calculate line total: taxableAmount + tax, rounded to 2 decimals
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
    grandTotal += total;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });
  }

  // Round all totals to 2 decimals
  return {
    lines,
    subtotal: Math.round(totalSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscountAmount * 100) / 100,
    totalTax: Math.round(totalTaxAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

export { LineItem, InvoiceResult, calculateInvoice };