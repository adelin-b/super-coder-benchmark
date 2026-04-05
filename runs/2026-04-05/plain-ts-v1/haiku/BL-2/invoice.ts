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
  const round = (num: number): number => {
    return Math.round(num * 100) / 100;
  };

  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate line subtotal (quantity * unitPrice), rounded per-line
    const lineSubtotal = round(item.quantity * item.unitPrice);
    subtotal = round(subtotal + lineSubtotal);

    // Calculate discount amount (percentage or fixed), rounded per-line
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(lineSubtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal (invariant: taxableAmount >= 0)
    discountAmount = Math.min(discountAmount, lineSubtotal);
    discountAmount = Math.max(0, discountAmount);
    totalDiscount = round(totalDiscount + discountAmount);

    // Calculate taxable amount (subtotal - discount), rounded per-line
    const taxableAmount = round(lineSubtotal - discountAmount);

    // Calculate tax amount (apply to taxableAmount, not subtotal), rounded per-line
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total (taxableAmount + taxAmount), rounded per-line
    const lineTotal = round(taxableAmount + taxAmount);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    totalTax = round(totalTax + taxAmount);
    grandTotal = round(grandTotal + lineTotal);
  }

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { LineItem, InvoiceResult, calculateInvoice };