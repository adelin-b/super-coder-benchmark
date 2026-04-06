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

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate line subtotal: quantity * unitPrice, rounded to cents
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount
        discountAmount = Math.round(lineSubtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        // Fixed discount (subtracted, not added)
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Cap discount at subtotal (discount can't exceed subtotal, making taxableAmount negative)
    discountAmount = Math.min(discountAmount, lineSubtotal);

    // Calculate taxable amount: subtotal - discountAmount, rounded to cents
    const taxableAmount = Math.round((lineSubtotal - discountAmount) * 100) / 100;

    // Calculate tax on taxableAmount (not on subtotal, to avoid over-taxing)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total: taxableAmount + taxAmount, rounded to cents
    const lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    // Accumulate totals (round per-line to avoid accumulation error)
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    grandTotal += lineTotal;
  }

  // Round the accumulated totals to cents
  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  grandTotal = Math.round(grandTotal * 100) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice, LineItem, InvoiceResult };