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

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!items || items.length === 0) {
    throw new Error("items must not be empty");
  }

  const lines = items.map((item) => {
    // Calculate subtotal: quantity * unitPrice
    let subtotal = item.quantity * item.unitPrice;
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) {
          throw new Error("percentage discount cannot exceed 100");
        }
        discountAmount = subtotal * (item.discount.value / 100);
      } else if (item.discount.type === 'fixed') {
        // Cap fixed discount at subtotal (don't throw)
        discountAmount = Math.min(item.discount.value, subtotal);
      }
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Calculate taxable amount (subtotal - discount)
    let taxableAmount = subtotal - discountAmount;
    taxableAmount = Math.round(taxableAmount * 100) / 100;
    // Ensure non-negative due to capping
    taxableAmount = Math.max(0, taxableAmount);

    // Calculate tax amount on taxableAmount (NOT on subtotal)
    let taxAmount = taxableAmount * item.taxRate;
    taxAmount = Math.round(taxAmount * 100) / 100;

    // Calculate line total
    let total = taxableAmount + taxAmount;
    total = Math.round(total * 100) / 100;

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  // Calculate invoice totals from rounded line items
  const subtotal = Math.round(
    lines.reduce((sum, line) => sum + line.subtotal, 0) * 100
  ) / 100;
  const totalDiscount = Math.round(
    lines.reduce((sum, line) => sum + line.discountAmount, 0) * 100
  ) / 100;
  const totalTax = Math.round(
    lines.reduce((sum, line) => sum + line.taxAmount, 0) * 100
  ) / 100;
  const grandTotal = Math.round(
    lines.reduce((sum, line) => sum + line.total, 0) * 100
  ) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}