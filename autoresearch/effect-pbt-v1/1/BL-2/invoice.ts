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

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: InvoiceResult['lines'] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    // Calculate subtotal (quantity * unitPrice)
    const lineSubtotal = roundTo2Decimals(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        discountAmount = roundTo2Decimals(lineSubtotal * (item.discount.value / 100));
      } else {
        discountAmount = roundTo2Decimals(item.discount.value);
      }
      // Clamp discount to [0, subtotal] to prevent negative taxableAmount
      discountAmount = Math.max(0, Math.min(discountAmount, lineSubtotal));
    }

    // Calculate taxable amount (subtotal minus discount)
    const taxableAmount = roundTo2Decimals(lineSubtotal - discountAmount);

    // Calculate tax on taxableAmount (not on subtotal)
    const taxAmount = roundTo2Decimals(taxableAmount * item.taxRate);

    // Calculate line total
    const lineTotal = roundTo2Decimals(taxableAmount + taxAmount);

    lines.push({
      subtotal: lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total: lineTotal,
    });

    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  }

  const roundedSubtotal = roundTo2Decimals(subtotal);
  const roundedTotalDiscount = roundTo2Decimals(totalDiscount);
  const roundedTotalTax = roundTo2Decimals(totalTax);
  const grandTotal = roundTo2Decimals(roundedSubtotal - roundedTotalDiscount + roundedTotalTax);

  return {
    lines,
    subtotal: roundedSubtotal,
    totalDiscount: roundedTotalDiscount,
    totalTax: roundedTotalTax,
    grandTotal,
  };
}