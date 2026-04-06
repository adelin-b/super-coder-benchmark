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
    throw new Error("Items array cannot be empty");
  }

  const lines = items.map(item => {
    // Validate inputs
    if (item.quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("Unit price cannot be negative");
    }
    if (item.taxRate < 0) {
      throw new Error("Tax rate cannot be negative");
    }
    if (item.discount && item.discount.value < 0) {
      throw new Error("Discount value cannot be negative");
    }

    // Helper function to round to cents
    const roundToCents = (value: number): number => {
      return Math.round(value * 100) / 100;
    };

    // Calculate subtotal - round per line
    const subtotal = roundToCents(item.quantity * item.unitPrice);

    // Calculate discount amount - round per line
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = roundToCents(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = roundToCents(item.discount.value);
      }
    }

    // Cap discount so taxableAmount doesn't go negative
    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = roundToCents(discountAmount);

    // Calculate taxable amount - tax is applied to taxableAmount, not subtotal
    const taxableAmount = roundToCents(subtotal - discountAmount);

    // Calculate tax amount - applied to taxableAmount only
    const taxAmount = roundToCents(taxableAmount * item.taxRate);

    // Calculate total
    const total = roundToCents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  // Calculate totals - round each sum
  const roundToCents = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  const subtotal = roundToCents(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = roundToCents(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const totalTax = roundToCents(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = roundToCents(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };