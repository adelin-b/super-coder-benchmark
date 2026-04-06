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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  const lines = items.map((item) => {
    if (item.quantity < 0) throw new Error("quantity must be non-negative");
    if (item.unitPrice < 0) throw new Error("unitPrice must be non-negative");
    if (item.taxRate < 0 || item.taxRate > 1) {
      throw new Error("taxRate must be between 0 and 1");
    }

    const subtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.value < 0) throw new Error("discount value must be non-negative");

      if (item.discount.type === "percentage") {
        // Clamp percentage discount to 0-100%
        const percentage = Math.min(100, item.discount.value);
        discountAmount = round(subtotal * (percentage / 100));
      } else if (item.discount.type === "fixed") {
        // Clamp fixed discount to not exceed subtotal
        discountAmount = round(Math.min(subtotal, item.discount.value));
      }
    }

    // Tax is applied to taxableAmount (after discount), not subtotal
    const taxableAmount = round(subtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const total = round(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

  const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const totalDiscount = round(
    lines.reduce((sum, line) => sum + line.discountAmount, 0)
  );
  const totalTax = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = round(lines.reduce((sum, line) => sum + line.total, 0));

  return {
    lines,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}