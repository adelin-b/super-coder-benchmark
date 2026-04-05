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
  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }

  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    // Validate line item inputs
    if (item.quantity < 0) {
      throw new Error('quantity must be non-negative');
    }
    if (item.unitPrice < 0) {
      throw new Error('unitPrice must be non-negative');
    }
    if (item.taxRate < 0 || item.taxRate > 1) {
      throw new Error('taxRate must be between 0 and 1');
    }

    // Calculate subtotal: quantity * unitPrice, rounded to cents
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.value < 0) {
        throw new Error('discount value must be non-negative');
      }

      if (item.discount.type === 'percentage') {
        // Percentage discount: apply percentage to subtotal
        discountAmount = Math.round(lineSubtotal * item.discount.value * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        // Fixed discount: use the fixed value
        discountAmount = Math.round(item.discount.value * 100) / 100;
      } else {
        throw new Error('discount type must be "percentage" or "fixed"');
      }

      // Cap discount at subtotal to ensure taxableAmount >= 0
      discountAmount = Math.min(discountAmount, lineSubtotal);
    }

    // Calculate taxable amount: subtotal - discount, rounded to cents
    const taxableAmount = Math.round((lineSubtotal - discountAmount) * 100) / 100;

    // Calculate tax: apply tax rate to taxableAmount (not subtotal), rounded to cents
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total: taxableAmount + taxAmount, rounded to cents
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    // Accumulate totals
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  }

  // Round aggregated totals to cents
  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  const grandTotal = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { LineItem, InvoiceResult, calculateInvoice };