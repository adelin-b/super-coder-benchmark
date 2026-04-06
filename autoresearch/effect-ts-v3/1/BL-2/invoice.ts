export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

export interface InvoiceResult {
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

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!items || items.length === 0) {
    throw new Error("Items must not be empty");
  }

  const lines = items.map((item) => {
    // Validate inputs
    if (item.quantity < 0) {
      throw new Error("Quantity must be non-negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("Unit price must be non-negative");
    }
    if (item.taxRate < 0) {
      throw new Error("Tax rate must be non-negative");
    }

    // Calculate subtotal
    const subtotal = roundToCents(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error("Percentage discount must be between 0 and 100");
        }
        discountAmount = roundToCents(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("Fixed discount cannot be negative");
        }
        discountAmount = roundToCents(item.discount.value);
      }
    }

    // Calculate taxable amount
    const taxableAmount = roundToCents(subtotal - discountAmount);

    // Validate taxable amount is non-negative
    if (taxableAmount < 0) {
      throw new Error("Discount cannot exceed subtotal");
    }

    // Calculate tax amount (applied to taxableAmount, not subtotal)
    const taxAmount = roundToCents(taxableAmount * item.taxRate);

    // Calculate total
    const total = roundToCents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  // Calculate invoice totals
  const subtotal = roundToCents(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = roundToCents(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const totalTax = roundToCents(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = roundToCents(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}