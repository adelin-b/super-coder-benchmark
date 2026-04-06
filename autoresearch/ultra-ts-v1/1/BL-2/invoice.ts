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
    throw new Error("items array is required and must not be empty");
  }

  const lines: Array<{
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }> = [];

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    if (item.quantity < 0) {
      throw new Error("quantity must not be negative");
    }
    if (item.unitPrice < 0) {
      throw new Error("unitPrice must not be negative");
    }
    if (item.taxRate < 0) {
      throw new Error("taxRate must not be negative");
    }
    if (item.discount && item.discount.value < 0) {
      throw new Error("discount value must not be negative");
    }

    const lineSubtotal = round(item.quantity * item.unitPrice);
    let discountAmount = 0;

    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = (lineSubtotal * item.discount.value) / 100;
      } else {
        discountAmount = item.discount.value;
      }
      discountAmount = Math.min(discountAmount, lineSubtotal);
    }

    discountAmount = round(discountAmount);
    const taxableAmount = round(lineSubtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const lineTotal = round(taxableAmount + taxAmount);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal
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
    grandTotal
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}