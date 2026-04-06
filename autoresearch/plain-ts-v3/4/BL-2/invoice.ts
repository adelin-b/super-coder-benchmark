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
  const lines = items.map(item => {
    // Calculate subtotal: quantity * unitPrice, rounded to cents
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = Math.round(subtotal * (item.discount.value / 100) * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }

    // Cap discount at subtotal to ensure taxableAmount >= 0
    discountAmount = Math.min(discountAmount, subtotal);

    // Calculate taxable amount (subtotal - discount), rounded to cents
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;

    // Calculate tax amount on taxableAmount (not subtotal), rounded to cents
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;

    // Calculate total: taxableAmount + taxAmount, rounded to cents
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });

  // Calculate invoice totals, rounded to cents
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
  const totalDiscount = Math.round(lines.reduce((sum, line) => sum + line.discountAmount, 0) * 100) / 100;
  const totalTax = Math.round(lines.reduce((sum, line) => sum + line.taxAmount, 0) * 100) / 100;
  const grandTotal = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export type { LineItem, InvoiceResult };