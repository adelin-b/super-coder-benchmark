interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // decimal, e.g. 0.20 for 20% VAT
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface LineItemResult {
  subtotal: number;    // quantity * unitPrice
  discountAmount: number;
  taxableAmount: number; // subtotal - discountAmount
  taxAmount: number;
  total: number;       // taxableAmount + taxAmount
}

interface InvoiceResult {
  lines: LineItemResult[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

class InvoiceCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceCalculationError';
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  const lines: LineItemResult[] = [];
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    // Validate inputs
    if (item.quantity < 0) {
      throw new InvoiceCalculationError(`Quantity cannot be negative for item: ${item.description}`);
    }
    if (item.unitPrice < 0) {
      throw new InvoiceCalculationError(`Unit price cannot be negative for item: ${item.description}`);
    }
    if (item.taxRate < 0) {
      throw new InvoiceCalculationError(`Tax rate cannot be negative for item: ${item.description}`);
    }

    // Calculate subtotal: quantity * unitPrice
    const subtotal = round(item.quantity * item.unitPrice);
    totalSubtotal += subtotal;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === 'percentage') {
        if (item.discount.value < 0 || item.discount.value > 100) {
          throw new InvoiceCalculationError(
            `Percentage discount must be between 0 and 100 for item: ${item.description}`
          );
        }
        discountAmount = round(subtotal * (item.discount.value / 100));
      } else if (item.discount.type === 'fixed') {
        if (item.discount.value < 0) {
          throw new InvoiceCalculationError(
            `Fixed discount cannot be negative for item: ${item.description}`
          );
        }
        discountAmount = round(item.discount.value);
      }
    }

    // Ensure discount doesn't exceed subtotal (invariant: taxableAmount >= 0)
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    totalDiscount += discountAmount;

    // Calculate taxable amount: subtotal - discountAmount
    const taxableAmount = round(subtotal - discountAmount);

    // Calculate tax on taxableAmount (not on subtotal - this avoids the "tax_on_discount" bug)
    const taxAmount = round(taxableAmount * item.taxRate);
    totalTax += taxAmount;

    // Calculate line total: taxableAmount + taxAmount
    const total = round(taxableAmount + taxAmount);
    grandTotal += total;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });
  }

  return {
    lines,
    subtotal: round(totalSubtotal),
    totalDiscount: round(totalDiscount),
    totalTax: round(totalTax),
    grandTotal: round(grandTotal)
  };
}

export { calculateInvoice, InvoiceCalculationError, LineItem, LineItemResult, InvoiceResult };