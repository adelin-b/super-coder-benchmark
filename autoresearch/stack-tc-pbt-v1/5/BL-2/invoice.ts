interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // decimal, e.g. 0.20 for 20% VAT
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface InvoiceResult {
  lines: Array<{
    subtotal: number;    // quantity * unitPrice
    discountAmount: number;
    taxableAmount: number; // subtotal - discountAmount
    taxAmount: number;
    total: number;       // taxableAmount + taxAmount
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
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal for this line
    const lineSubtotal = round(item.quantity * item.unitPrice);
    subtotal += lineSubtotal;

    // Calculate discount for this line
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = lineSubtotal * (item.discount.value / 100);
      } else if (item.discount.type === 'fixed') {
        discountAmount = item.discount.value;
      }
    }
    // Cap discount at subtotal to prevent negative taxableAmount
    discountAmount = Math.min(discountAmount, lineSubtotal);
    discountAmount = round(discountAmount);
    totalDiscount += discountAmount;

    // Calculate taxable amount (after discount)
    const taxableAmount = round(lineSubtotal - discountAmount);

    // Calculate tax on taxable amount (not on subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);
    totalTax += taxAmount;

    // Calculate total for this line
    const lineTotal = round(taxableAmount + taxAmount);
    grandTotal += lineTotal;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });
  }

  return {
    lines,
    subtotal: round(subtotal),
    totalDiscount: round(totalDiscount),
    totalTax: round(totalTax),
    grandTotal: round(grandTotal),
  };
}

export { calculateInvoice, LineItem, InvoiceResult };