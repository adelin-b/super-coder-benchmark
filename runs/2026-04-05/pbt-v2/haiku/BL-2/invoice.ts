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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines = items.map(item => {
    // Calculate subtotal per line
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = subtotal * (item.discount.value / 100);
      } else {
        discountAmount = item.discount.value;
      }
      discountAmount = round(discountAmount);
    }

    // Clamp discount to subtotal (prevent negative taxableAmount)
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    // Calculate taxable amount
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxableAmount (not subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total
    const total = round(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  // Calculate aggregates
  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = round(
    lines.reduce((sum, line) => sum + line.discountAmount, 0)
  );
  const totalTax = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = round(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { LineItem, InvoiceResult, calculateInvoice };