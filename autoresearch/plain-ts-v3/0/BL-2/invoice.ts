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

function roundToTwoDec(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    // Calculate subtotal for this line: quantity * unitPrice
    const lineSubtotal = roundToTwoDec(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount: clamp to 100% to prevent negative taxableAmount
        const discountPercent = Math.min(Math.max(item.discount.value, 0), 100);
        discountAmount = roundToTwoDec(lineSubtotal * (discountPercent / 100));
      } else if (item.discount.type === 'fixed') {
        // Fixed discount: clamp to subtotal to prevent negative taxableAmount
        discountAmount = roundToTwoDec(Math.min(Math.max(item.discount.value, 0), lineSubtotal));
      }
    }

    // Calculate taxable amount: subtotal - discountAmount
    const taxableAmount = roundToTwoDec(lineSubtotal - discountAmount);

    // Calculate tax amount: apply tax to taxableAmount, not subtotal
    const taxAmount = roundToTwoDec(taxableAmount * item.taxRate);

    // Calculate line total: taxableAmount + taxAmount
    const total = roundToTwoDec(taxableAmount + taxAmount);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    subtotal = roundToTwoDec(subtotal + lineSubtotal);
    totalDiscount = roundToTwoDec(totalDiscount + discountAmount);
    totalTax = roundToTwoDec(totalTax + taxAmount);
  }

  // Calculate grand total as sum of all line totals
  const grandTotal = roundToTwoDec(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };