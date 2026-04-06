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

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!items || items.length === 0) {
    throw new Error("items must not be empty");
  }

  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    if (item.quantity < 0) throw new Error("quantity cannot be negative");
    if (item.unitPrice < 0) throw new Error("unitPrice cannot be negative");
    if (item.taxRate < 0) throw new Error("taxRate cannot be negative");

    // Calculate subtotal
    const lineSubtotal = item.quantity * item.unitPrice;
    const roundedSubtotal = Math.round(lineSubtotal * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) {
          throw new Error("percentage discount cannot exceed 100");
        }
        if (item.discount.value < 0) {
          throw new Error("percentage discount cannot be negative");
        }
        discountAmount = (lineSubtotal * item.discount.value) / 100;
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("fixed discount cannot be negative");
        }
        discountAmount = item.discount.value;
      }
    }

    // Cap discount at subtotal (invariant: taxableAmount >= 0)
    discountAmount = Math.min(discountAmount, lineSubtotal);
    const roundedDiscountAmount = Math.round(discountAmount * 100) / 100;

    // Calculate taxable amount
    const taxableAmount = lineSubtotal - discountAmount;
    const roundedTaxableAmount = Math.round(taxableAmount * 100) / 100;

    // Apply tax to taxableAmount (not subtotal)
    const taxAmount = taxableAmount * item.taxRate;
    const roundedTaxAmount = Math.round(taxAmount * 100) / 100;

    // Calculate line total
    const lineTotal = taxableAmount + taxAmount;
    const roundedLineTotal = Math.round(lineTotal * 100) / 100;

    lines.push({
      subtotal: roundedSubtotal,
      discountAmount: roundedDiscountAmount,
      taxableAmount: roundedTaxableAmount,
      taxAmount: roundedTaxAmount,
      total: roundedLineTotal,
    });

    // Accumulate rounded values
    subtotal += roundedSubtotal;
    totalDiscount += roundedDiscountAmount;
    totalTax += roundedTaxAmount;
    grandTotal += roundedLineTotal;
  }

  // Round final totals
  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  grandTotal = Math.round(grandTotal * 100) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}