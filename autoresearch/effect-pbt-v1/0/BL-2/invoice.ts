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

function round(num: number): number {
  return Math.round(num * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!items || items.length === 0) {
    throw new Error("items array must not be empty");
  }

  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Validate inputs
    if (item.quantity < 0) {
      throw new Error("quantity must be non-negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("unitPrice must be non-negative");
    }
    if (item.taxRate < 0) {
      throw new Error("taxRate must be non-negative");
    }

    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 1) {
          throw new Error("percentage discount must be between 0 and 1");
        }
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("fixed discount must be non-negative");
        }
      }
    }

    // Calculate line items
    const lineSubtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = round(lineSubtotal * item.discount.value);
      } else {
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > lineSubtotal) {
      discountAmount = lineSubtotal;
    }

    const taxableAmount = round(lineSubtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const lineTotal = round(taxableAmount + taxAmount);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    subtotal = round(subtotal + lineSubtotal);
    totalDiscount = round(totalDiscount + discountAmount);
    totalTax = round(totalTax + taxAmount);
    grandTotal = round(grandTotal + lineTotal);
  }

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export type { LineItem, InvoiceResult };