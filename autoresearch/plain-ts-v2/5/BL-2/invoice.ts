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
  if (!items || items.length === 0) {
    throw new Error('Items array cannot be empty');
  }

  const lines: InvoiceResult['lines'] = [];

  for (const item of items) {
    if (typeof item.description !== 'string' || item.description.trim() === '') {
      throw new Error('Description must be a non-empty string');
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new Error('Quantity must be a positive number');
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new Error('Unit price must be non-negative');
    }
    if (typeof item.taxRate !== 'number' || item.taxRate < 0 || item.taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }
    if (item.discount) {
      if (item.discount.value < 0) {
        throw new Error('Discount value must be non-negative');
      }
      if (item.discount.type !== 'percentage' && item.discount.type !== 'fixed') {
        throw new Error('Discount type must be "percentage" or "fixed"');
      }
    }

    const subtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = subtotal * item.discount.value;
      } else {
        discountAmount = item.discount.value;
      }
      discountAmount = Math.min(discountAmount, subtotal);
    }
    discountAmount = round(discountAmount);

    const taxableAmount = round(subtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const lineTotal = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal
    });
  }

  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = round(lines.reduce((sum, line) => sum + line.discountAmount, 0));
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