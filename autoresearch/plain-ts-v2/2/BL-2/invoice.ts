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
    throw new Error('items must be an array');
  }

  const lines: Array<{
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }> = [];

  let totalSubtotal = 0;
  let totalDiscountAmount = 0;
  let totalTaxAmount = 0;
  let totalLineTotal = 0;

  for (const item of items) {
    // Validate inputs
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      throw new Error('quantity must be a non-negative number');
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new Error('unitPrice must be a non-negative number');
    }
    if (typeof item.taxRate !== 'number' || item.taxRate < 0) {
      throw new Error('taxRate must be a non-negative number');
    }

    // Calculate subtotal
    const subtotal = round(item.quantity * item.unitPrice);
    totalSubtotal += subtotal;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error('percentage discount must be between 0 and 100');
        }
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error('fixed discount must be non-negative');
        }
        discountAmount = round(item.discount.value);
      }
    }

    // Validate that discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
      throw new Error('discount cannot exceed subtotal');
    }

    // Calculate taxable amount (subtotal minus discount)
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax amount (applied to taxable amount, not subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate line total
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
    totalLineTotal += total;
  }

  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscountAmount),
    totalTax: round(totalTaxAmount),
    grandTotal: round(totalLineTotal)
  };
}

export { calculateInvoice, LineItem, InvoiceResult };