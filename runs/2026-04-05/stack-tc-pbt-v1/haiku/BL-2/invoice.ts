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
    // Calculate subtotal: quantity * unitPrice, rounded to 2 decimals
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount: calculate and cap at subtotal
        discountAmount = round((subtotal * item.discount.value) / 100);
        // Ensure discount doesn't exceed subtotal (Invariant 3)
        discountAmount = Math.min(discountAmount, subtotal);
      } else {
        // Fixed discount: cap at subtotal
        discountAmount = Math.min(item.discount.value, subtotal);
      }
    }
    discountAmount = round(discountAmount);

    // Calculate taxableAmount: subtotal - discountAmount
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax: taxableAmount * taxRate (NOT subtotal - this avoids the tax_on_discount bug)
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total: taxableAmount + taxAmount
    const total = round(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  // Calculate summary totals
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
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };