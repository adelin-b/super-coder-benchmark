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
  const round = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

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
    // Calculate subtotal per-line and round
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount per-line and round
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal (prevents negative taxableAmount)
    discountAmount = Math.min(discountAmount, subtotal);

    // Calculate taxable amount (after discount) and round
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxableAmount (not on subtotal) and round
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total and round
    const lineTotal = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    // Accumulate totals
    totalSubtotal += subtotal;
    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
    totalGrandTotal += lineTotal;
  }

  // Round final totals to 2 decimal places
  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscountAmount),
    totalTax: round(totalTaxAmount),
    grandTotal: round(totalGrandTotal),
  };
}

export { calculateInvoice };
export type { LineItem, InvoiceResult };