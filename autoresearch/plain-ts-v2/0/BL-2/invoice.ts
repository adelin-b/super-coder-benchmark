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

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal per line, rounded to cents
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Calculate percentage discount and clamp to not exceed subtotal
        const calculatedDiscount = Math.round(
          lineSubtotal * item.discount.value * 100
        ) / 100;
        discountAmount = Math.min(calculatedDiscount, lineSubtotal);
      } else if (item.discount.type === 'fixed') {
        // Fixed discount, clamped to not exceed subtotal
        discountAmount = Math.min(item.discount.value, lineSubtotal);
      }
    }

    // Ensure discount amount is never negative
    discountAmount = Math.max(0, discountAmount);

    // Calculate taxable amount (subtotal minus discount), rounded to cents
    const taxableAmount = Math.round(
      (lineSubtotal - discountAmount) * 100
    ) / 100;

    // Calculate tax on taxableAmount (not on subtotal), rounded to cents
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total, rounded to cents
    const lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal
    });

    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    grandTotal += lineTotal;
  }

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

export { calculateInvoice, LineItem, InvoiceResult };