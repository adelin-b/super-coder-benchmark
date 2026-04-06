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

  const lines: InvoiceResult['lines'] = [];
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal (quantity × unitPrice), rounded per-line
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    // Calculate taxable amount (subtotal - discount), rounded
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxable amount (not subtotal), rounded
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total (taxable + tax), rounded
    const total = round(taxableAmount + taxAmount);

    // Accumulate totals
    totalSubtotal += subtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    grandTotal += total;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });
  }

  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscount),
    totalTax: round(totalTax),
    grandTotal: round(grandTotal)
  };
}

export { LineItem, InvoiceResult, calculateInvoice };