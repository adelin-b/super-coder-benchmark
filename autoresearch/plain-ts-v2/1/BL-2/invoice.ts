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
  // Validate inputs
  for (const item of items) {
    if (item.quantity < 0) throw new Error('Quantity cannot be negative');
    if (item.unitPrice < 0) throw new Error('Unit price cannot be negative');
    if (item.taxRate < 0) throw new Error('Tax rate cannot be negative');
    
    if (item.discount) {
      if (item.discount.value < 0) throw new Error('Discount value cannot be negative');
      if (item.discount.type === 'percentage' && item.discount.value > 100) {
        throw new Error('Percentage discount cannot exceed 100%');
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
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Calculate subtotal for this line
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = subtotal * (item.discount.value / 100);
      } else if (item.discount.type === 'fixed') {
        discountAmount = item.discount.value;
      }
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Validate discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
      throw new Error('Discount cannot exceed subtotal');
    }

    // Calculate taxable amount (subtotal minus discount)
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    // Calculate tax on taxable amount (not on subtotal)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate line total
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    totalSubtotal += subtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    grandTotal += total;
  }

  // Round totals to 2 decimal places
  totalSubtotal = Math.round(totalSubtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  grandTotal = Math.round(grandTotal * 100) / 100;

  return {
    lines,
    subtotal: totalSubtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { calculateInvoice, LineItem, InvoiceResult };