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

function roundTocents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!items || items.length === 0) {
    throw new Error("Items array cannot be empty");
  }

  const lines: InvoiceResult['lines'] = [];
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    if (item.quantity < 0) throw new Error("Quantity cannot be negative");
    if (item.unitPrice < 0) throw new Error("Unit price cannot be negative");
    if (item.taxRate < 0) throw new Error("Tax rate cannot be negative");

    const subtotal = roundTocents(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error("Percentage discount must be between 0 and 100");
        }
        discountAmount = roundTocents(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error("Fixed discount cannot be negative");
        }
        discountAmount = roundTocents(item.discount.value);
      }
    }

    if (discountAmount > subtotal) {
      throw new Error("Discount amount cannot exceed subtotal");
    }

    const taxableAmount = roundTocents(subtotal - discountAmount);
    const taxAmount = roundTocents(taxableAmount * item.taxRate);
    const total = roundTocents(taxableAmount + taxAmount);

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
  }

  const roundedTotalSubtotal = roundTocents(totalSubtotal);
  const roundedTotalDiscount = roundTocents(totalDiscount);
  const roundedTotalTax = roundTocents(totalTax);
  const grandTotal = roundTocents(roundedTotalSubtotal - roundedTotalDiscount + roundedTotalTax);

  return {
    lines,
    subtotal: roundedTotalSubtotal,
    totalDiscount: roundedTotalDiscount,
    totalTax: roundedTotalTax,
    grandTotal
  };
}