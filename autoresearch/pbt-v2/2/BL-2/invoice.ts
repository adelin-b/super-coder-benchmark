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
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal for this line
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    subtotal += lineSubtotal;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = Math.round(lineSubtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, lineSubtotal);
    totalDiscount += discountAmount;

    // Calculate taxable amount
    const taxableAmount = Math.round((lineSubtotal - discountAmount) * 100) / 100;

    // Calculate tax on taxableAmount (not on subtotal)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total
    const lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    totalTax += taxAmount;
    grandTotal += lineTotal;
  }

  // Round totals
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