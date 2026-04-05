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
  const round = (value: number): number => Math.round(value * 100) / 100;
  
  const lines = items.map(item => {
    // Calculate subtotal: quantity * unitPrice
    const subtotal = round(item.quantity * item.unitPrice);
    
    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        // Percentage discount: percentage of subtotal
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else {
        // Fixed discount
        discountAmount = round(item.discount.value);
      }
    }
    
    // Calculate taxable amount (subtotal - discount, but minimum 0)
    let taxableAmount = round(subtotal - discountAmount);
    taxableAmount = Math.max(0, taxableAmount);
    
    // Calculate tax on taxable amount (after discount, not on subtotal)
    const taxAmount = round(taxableAmount * item.taxRate);
    
    // Total for this line: taxableAmount + taxAmount
    const total = round(taxableAmount + taxAmount);
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  });
  
  // Calculate invoice totals by summing all lines
  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = round(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const totalTax = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = round(lines.reduce((sum, line) => sum + line.total, 0));
  
  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal
  };
}

export { LineItem, InvoiceResult, calculateInvoice };