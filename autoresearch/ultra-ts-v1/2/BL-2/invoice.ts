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
    throw new Error('items array is required and cannot be empty');
  }

  const lines = items.map(item => {
    // Validate inputs
    if (item.quantity < 0) throw new Error('quantity must be non-negative');
    if (item.unitPrice < 0) throw new Error('unitPrice must be non-negative');
    if (item.taxRate < 0) throw new Error('taxRate must be non-negative');

    // Calculate subtotal and round
    let subtotal = item.quantity * item.unitPrice;
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.value < 0) throw new Error('discount value must be non-negative');

      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) throw new Error('percentage discount cannot exceed 100%');
        discountAmount = subtotal * item.discount.value / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.min(item.discount.value, subtotal);
      }
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Calculate taxable amount (subtotal minus discount, never negative)
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    // Calculate tax on taxable amount (not subtotal)
    let taxAmount = taxableAmount * item.taxRate;
    taxAmount = Math.round(taxAmount * 100) / 100;

    // Calculate line total
    const total = taxableAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  // Aggregate totals
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
  const totalDiscount = Math.round(lines.reduce((sum, line) => sum + line.discountAmount, 0) * 100) / 100;
  const totalTax = Math.round(lines.reduce((sum, line) => sum + line.taxAmount, 0) * 100) / 100;
  const grandTotal = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };