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

function round(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  // Validate inputs
  if (!Array.isArray(items)) {
    throw new Error("items must be an array");
  }

  for (const item of items) {
    if (item.quantity < 0) throw new Error("quantity cannot be negative");
    if (item.unitPrice < 0) throw new Error("unitPrice cannot be negative");
    if (item.taxRate < 0) throw new Error("taxRate cannot be negative");

    if (item.discount) {
      if (item.discount.value < 0) throw new Error("discount value cannot be negative");
      if (item.discount.type === 'percentage' && item.discount.value > 100) {
        throw new Error("percentage discount cannot exceed 100%");
      }
    }
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

  for (const item of items) {
    // Calculate subtotal: quantity * unitPrice
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else {
        // Fixed discount capped at subtotal
        discountAmount = round(Math.min(item.discount.value, subtotal));
      }
    }

    // Calculate taxable amount: subtotal - discountAmount
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax amount: apply tax to taxableAmount (not subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate total: taxableAmount + taxAmount
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    totalSubtotal += subtotal;
    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
  }

  // Round aggregate totals
  const subtotal = round(totalSubtotal);
  const totalDiscount = round(totalDiscountAmount);
  const totalTax = round(totalTaxAmount);
  const grandTotal = round(subtotal - totalDiscount + totalTax);

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}