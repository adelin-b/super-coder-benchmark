export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

export interface InvoiceResult {
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

export function calculateInvoice(items: LineItem[]): InvoiceResult {
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
    // Calculate line subtotal (quantity * unitPrice)
    const lineSubtotal = round(item.quantity * item.unitPrice);
    subtotal += lineSubtotal;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(lineSubtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > lineSubtotal) {
      discountAmount = lineSubtotal;
    }

    totalDiscount += discountAmount;

    // Calculate taxable amount (subtotal - discount)
    const taxableAmount = round(lineSubtotal - discountAmount);

    // Calculate tax amount (applied to taxableAmount, not subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);

    totalTax += taxAmount;

    // Calculate line total (taxableAmount + tax)
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}