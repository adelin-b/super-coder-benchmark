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
    throw new Error('Items array cannot be empty');
  }

  const round = (num: number): number => Math.round(num * 100) / 100;

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
    if (item.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    if (item.unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }
    if (item.taxRate < 0 || item.taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }

    const subtotal = round(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new Error('Percentage discount must be between 0 and 100');
        }
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new Error('Fixed discount cannot be negative');
        }
        discountAmount = round(item.discount.value);
      }
    }

    if (discountAmount > subtotal) {
      throw new Error('Discount amount cannot exceed subtotal');
    }

    const taxableAmount = round(subtotal - discountAmount);
    const taxAmount = round(taxableAmount * item.taxRate);
    const total = round(taxableAmount + taxAmount);

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    });

    totalSubtotal += subtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    grandTotal += total;
  }

  totalSubtotal = round(totalSubtotal);
  totalDiscount = round(totalDiscount);
  totalTax = round(totalTax);
  grandTotal = round(grandTotal);

  return {
    lines,
    subtotal: totalSubtotal,
    totalDiscount,
    totalTax,
    grandTotal,
  };
}

export { calculateInvoice, LineItem, InvoiceResult };