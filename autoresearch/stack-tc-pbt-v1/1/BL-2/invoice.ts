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
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items array must not be empty");
  }

  const round = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  const lines: InvoiceResult['lines'] = [];
  let grandSubtotal = 0;
  let grandTotalDiscount = 0;
  let grandTotalTax = 0;

  for (const item of items) {
    if (typeof item.description !== 'string') {
      throw new Error("Description must be a string");
    }
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      throw new Error("Quantity must be a non-negative number");
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new Error("Unit price must be a non-negative number");
    }
    if (typeof item.taxRate !== 'number' || item.taxRate < 0) {
      throw new Error("Tax rate must be a non-negative number");
    }

    const subtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error("Percentage discount must be between 0 and 100");
        }
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("Fixed discount must be non-negative");
        }
        discountAmount = round(item.discount.value);
      } else {
        throw new Error("Discount type must be 'percentage' or 'fixed'");
      }
    }

    const taxableAmount = round(subtotal - discountAmount);
    if (taxableAmount < 0) {
      throw new Error("Discount cannot exceed subtotal");
    }

    const taxAmount = round(taxableAmount * item.taxRate);
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    grandSubtotal += subtotal;
    grandTotalDiscount += discountAmount;
    grandTotalTax += taxAmount;
  }

  return {
    lines,
    subtotal: round(grandSubtotal),
    totalDiscount: round(grandTotalDiscount),
    totalTax: round(grandTotalTax),
    grandTotal: round(grandSubtotal - grandTotalDiscount + grandTotalTax),
  };
}

export { calculateInvoice };
export type { LineItem, InvoiceResult };