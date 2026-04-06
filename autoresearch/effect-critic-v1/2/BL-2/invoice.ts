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
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items array cannot be empty");
  }

  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Validate inputs
    if (item.quantity < 0) throw new Error("Quantity cannot be negative");
    if (item.unitPrice < 0) throw new Error("Unit price cannot be negative");
    if (item.taxRate < 0) throw new Error("Tax rate cannot be negative");
    
    if (item.discount) {
      if (item.discount.value < 0) throw new Error("Discount value cannot be negative");
      if (item.discount.type === 'percentage' && item.discount.value > 100) {
        throw new Error("Percentage discount cannot exceed 100%");
      }
    }

    // Calculate line subtotal
    const lineSubtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(lineSubtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount does not exceed subtotal
    if (discountAmount > lineSubtotal) {
      throw new Error("Discount cannot exceed subtotal");
    }

    // Calculate taxable amount and tax (tax applied to taxableAmount, not subtotal)
    const taxableAmount = round(lineSubtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const total = round(taxableAmount + taxAmount);

    // Add line to result
    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    // Update totals (round per-line to avoid accumulation errors)
    subtotal = round(subtotal + lineSubtotal);
    totalDiscount = round(totalDiscount + discountAmount);
    totalTax = round(totalTax + taxAmount);
    grandTotal = round(grandTotal + total);
  }

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}