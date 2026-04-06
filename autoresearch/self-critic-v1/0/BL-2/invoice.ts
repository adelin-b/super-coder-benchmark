interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // decimal, e.g. 0.20 for 20% VAT
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface InvoiceResult {
  lines: Array<{
    subtotal: number;    // quantity * unitPrice
    discountAmount: number;
    taxableAmount: number; // subtotal - discountAmount
    taxAmount: number;
    total: number;       // taxableAmount + taxAmount
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines = items.map(item => {
    // Calculate subtotal and round to 2 decimal places
    const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    
    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = Math.round(subtotal * item.discount.value / 100 * 100) / 100;
      } else if (item.discount.type === 'fixed') {
        discountAmount = Math.round(item.discount.value * 100) / 100;
      }
    }
    
    // Calculate taxable amount (subtotal minus discount, rounded per-line)
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    
    // Enforce invariant: discount cannot exceed subtotal
    if (taxableAmount < 0) {
      throw new Error(`Discount cannot exceed subtotal for item: ${item.description}`);
    }
    
    // Calculate tax on taxable amount (not on subtotal to avoid over-taxation)
    const taxAmount = Math.round(taxableAmount * item.taxRate * 100) / 100;
    
    // Calculate total per line
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });
  
  // Calculate invoice totals, summing already-rounded line values
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

export { calculateInvoice, LineItem, InvoiceResult };