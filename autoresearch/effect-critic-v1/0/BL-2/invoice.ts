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
  // Validate input
  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }

  const lines: InvoiceResult['lines'] = [];

  let aggregateSubtotal = 0;
  let aggregateTotalDiscount = 0;
  let aggregateTotalTax = 0;
  let aggregateGrandTotal = 0;

  for (const item of items) {
    // Validate line item
    if (item.quantity < 0) {
      throw new Error("Quantity must be non-negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("Unit price must be non-negative");
    }
    if (item.taxRate < 0) {
      throw new Error("Tax rate must be non-negative");
    }
    if (item.discount) {
      if (item.discount.value < 0) {
        throw new Error("Discount value must be non-negative");
      }
      if (item.discount.type !== 'percentage' && item.discount.type !== 'fixed') {
        throw new Error("Discount type must be 'percentage' or 'fixed'");
      }
    }

    // Calculate subtotal
    const subtotal = round(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(subtotal * (item.discount.value / 100));
        // Cap discount at subtotal to prevent negative taxableAmount
        discountAmount = Math.min(discountAmount, subtotal);
      } else if (item.discount.type === 'fixed') {
        discountAmount = round(item.discount.value);
        // Cap discount at subtotal to prevent negative taxableAmount
        discountAmount = Math.min(discountAmount, subtotal);
      }
    }

    // Calculate taxable amount (apply tax to taxableAmount, not subtotal)
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax amount
    const taxAmount = round(taxableAmount * item.taxRate);

    // Calculate total (round per-line, not at end)
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    aggregateSubtotal += subtotal;
    aggregateTotalDiscount += discountAmount;
    aggregateTotalTax += taxAmount;
    aggregateGrandTotal += total;
  }

  return {
    lines,
    subtotal: round(aggregateSubtotal),
    totalDiscount: round(aggregateTotalDiscount),
    totalTax: round(aggregateTotalTax),
    grandTotal: round(aggregateGrandTotal)
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}