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
  if (!items || items.length === 0) {
    throw new Error("items must not be empty");
  }

  const lines: InvoiceResult['lines'] = [];
  let subtotalSum = 0;
  let totalDiscountSum = 0;
  let totalTaxSum = 0;
  let grandTotalSum = 0;

  for (const item of items) {
    // Validate inputs
    if (item.quantity < 0) throw new Error("quantity cannot be negative");
    if (item.unitPrice < 0) throw new Error("unitPrice cannot be negative");
    if (item.taxRate < 0) throw new Error("taxRate cannot be negative");
    if (item.discount && item.discount.value < 0) throw new Error("discount value cannot be negative");

    // Calculate subtotal (quantity * unitPrice), rounded to 2 decimals
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) throw new Error("percentage discount cannot exceed 100");
        discountAmount = Math.round(subtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        // Cap fixed discount at subtotal to avoid negative taxable amount
        discountAmount = Math.min(item.discount.value, subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    // Calculate taxable amount (subtotal - discountAmount), rounded to 2 decimals
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    // Ensure taxable amount is never negative
    const safeTaxableAmount = Math.max(0, taxableAmount);

    // Calculate tax on taxableAmount (not subtotal), rounded to 2 decimals
    const taxAmount = Math.round(safeTaxableAmount * item.taxRate * 100) / 100;

    // Calculate line total, rounded to 2 decimals
    const total = Math.round((safeTaxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount: safeTaxableAmount,
      taxAmount,
      total,
    });

    // Accumulate sums
    subtotalSum += subtotal;
    totalDiscountSum += discountAmount;
    totalTaxSum += taxAmount;
    grandTotalSum += total;
  }

  // Round aggregated sums to avoid floating-point accumulation errors
  subtotalSum = Math.round(subtotalSum * 100) / 100;
  totalDiscountSum = Math.round(totalDiscountSum * 100) / 100;
  totalTaxSum = Math.round(totalTaxSum * 100) / 100;
  grandTotalSum = Math.round(grandTotalSum * 100) / 100;

  return {
    lines,
    subtotal: subtotalSum,
    totalDiscount: totalDiscountSum,
    totalTax: totalTaxSum,
    grandTotal: grandTotalSum,
  };
}