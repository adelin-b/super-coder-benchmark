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
  const round = (n: number): number => Math.round(n * 100) / 100;

  const lines: InvoiceResult['lines'] = [];
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal: quantity * unitPrice
    const subtotal = round(item.quantity * item.unitPrice);
    totalSubtotal += subtotal;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else {
        // fixed discount
        discountAmount = round(item.discount.value);
      }
      // Cap discount at subtotal so taxableAmount doesn't go negative
      discountAmount = Math.min(discountAmount, subtotal);
    }
    totalDiscount += discountAmount;

    // Calculate taxable amount (subtotal after discount)
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxableAmount (not on subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);
    totalTax += taxAmount;

    // Calculate total for this line
    const total = round(taxableAmount + taxAmount);
    grandTotal += total;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });
  }

  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscount),
    totalTax: round(totalTax),
    grandTotal: round(grandTotal),
  };
}

export { calculateInvoice, LineItem, InvoiceResult };