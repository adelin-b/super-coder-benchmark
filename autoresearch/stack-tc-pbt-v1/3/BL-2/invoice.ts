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
  const lines: InvoiceResult['lines'] = [];

  let summarySubtotal = 0;
  let summaryDiscount = 0;
  let summaryTax = 0;
  let summaryGrandTotal = 0;

  for (const item of items) {
    // Calculate subtotal (quantity * unitPrice)
    let subtotal = item.quantity * item.unitPrice;
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = subtotal * (item.discount.value / 100);
      } else if (item.discount.type === 'fixed') {
        discountAmount = item.discount.value;
      }
      // Cap discount at subtotal so taxableAmount never goes negative
      discountAmount = Math.min(discountAmount, subtotal);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Calculate taxable amount (subtotal - discount)
    let taxableAmount = subtotal - discountAmount;
    taxableAmount = Math.round(taxableAmount * 100) / 100;

    // Calculate tax on taxable amount (not on subtotal - avoids over-taxation)
    let taxAmount = taxableAmount * item.taxRate;
    taxAmount = Math.round(taxAmount * 100) / 100;

    // Calculate line total
    let total = taxableAmount + taxAmount;
    total = Math.round(total * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    summarySubtotal += subtotal;
    summaryDiscount += discountAmount;
    summaryTax += taxAmount;
    summaryGrandTotal += total;
  }

  // Round summary totals to cents
  summarySubtotal = Math.round(summarySubtotal * 100) / 100;
  summaryDiscount = Math.round(summaryDiscount * 100) / 100;
  summaryTax = Math.round(summaryTax * 100) / 100;
  summaryGrandTotal = Math.round(summaryGrandTotal * 100) / 100;

  return {
    lines,
    subtotal: summarySubtotal,
    totalDiscount: summaryDiscount,
    totalTax: summaryTax,
    grandTotal: summaryGrandTotal,
  };
}

export { calculateInvoice, LineItem, InvoiceResult };