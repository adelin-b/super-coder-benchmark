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
  // Helper to round to 2 decimal places (cents)
  const round = (value: number): number => Math.round(value * 100) / 100;

  const lines: InvoiceResult['lines'] = [];
  let accumSubtotal = 0;
  let accumDiscount = 0;
  let accumTax = 0;

  for (const item of items) {
    // Calculate subtotal for this line: quantity × unitPrice
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount for this line
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else {
        // type === 'fixed'
        discountAmount = round(item.discount.value);
      }
    }

    // Clamp discount to prevent taxableAmount from going negative
    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

    // Taxable amount = subtotal - discount
    const taxableAmount = round(subtotal - discountAmount);

    // Tax is applied to taxableAmount (after discount), not original subtotal
    const taxAmount = round(taxableAmount * item.taxRate);

    // Line total = taxableAmount + taxAmount
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    // Accumulate per-line rounded values to avoid floating point drift
    accumSubtotal += subtotal;
    accumDiscount += discountAmount;
    accumTax += taxAmount;
  }

  // Round the accumulated totals
  const subtotal = round(accumSubtotal);
  const totalDiscount = round(accumDiscount);
  const totalTax = round(accumTax);

  // Grand total = subtotal - discount + tax
  const grandTotal = round(subtotal - totalDiscount + totalTax);

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice };
export type { LineItem, InvoiceResult };