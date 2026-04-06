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
  if (!items || items.length === 0) {
    throw new Error("items required");
  }

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
    // Validate inputs
    if (item.quantity < 0) {
      throw new Error("quantity cannot be negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("unitPrice cannot be negative");
    }
    if (item.taxRate < 0 || item.taxRate > 1) {
      throw new Error("taxRate must be between 0 and 1");
    }

    // Calculate line subtotal, rounded to cents
    let lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error("percentage discount must be between 0 and 100");
        }
        discountAmount = Math.round(lineSubtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("fixed discount cannot be negative");
        }
        // Cap fixed discount at subtotal
        discountAmount = Math.min(item.discount.value, lineSubtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    // Calculate taxable amount (subtotal - discount, never negative)
    let taxableAmount = Math.max(0, lineSubtotal - discountAmount);
    taxableAmount = Math.round(taxableAmount * 100) / 100;

    // Calculate tax on taxable amount (not on discount)
    let taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total
    let total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    // Accumulate totals, rounding per-line not at end
    subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
    totalDiscount = Math.round((totalDiscount + discountAmount) * 100) / 100;
    totalTax = Math.round((totalTax + taxAmount) * 100) / 100;
    grandTotal = Math.round((grandTotal + total) * 100) / 100;
  }

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice };
export type { LineItem, InvoiceResult };