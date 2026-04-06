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
  if (!Array.isArray(items)) {
    throw new Error("items must be an array");
  }

  const lines: InvoiceResult['lines'] = [];

  for (const item of items) {
    if (!item) {
      throw new Error("item must be defined");
    }
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      throw new Error("quantity must be non-negative number");
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new Error("unitPrice must be non-negative number");
    }
    if (typeof item.taxRate !== 'number' || item.taxRate < 0) {
      throw new Error("taxRate must be non-negative number");
    }
    if (item.discount && (typeof item.discount.value !== 'number' || item.discount.value < 0)) {
      throw new Error("discount value must be non-negative number");
    }

    const subtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        const clampedPercent = Math.min(item.discount.value, 100);
        discountAmount = round((subtotal * clampedPercent) / 100);
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(Math.min(item.discount.value, subtotal));
      }
    }

    const taxableAmount = round(subtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const totalDiscount = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const totalTax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const grandTotal = lines.reduce((sum, line) => sum + line.total, 0);

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };