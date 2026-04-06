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

class InvalidInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInvoiceError';
  }
}

function calculateInvoice(items: LineItem[]): InvoiceResult {
  // Validate input
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidInvoiceError('Items array must not be empty');
  }

  const lines: Array<{
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }> = [];

  let totalSubtotal = 0;
  let totalDiscountAmount = 0;
  let totalTaxAmount = 0;
  let totalLineTotal = 0;

  for (const item of items) {
    // Validate quantity
    if (!Number.isFinite(item.quantity)) {
      throw new InvalidInvoiceError('Quantity must be a finite number');
    }
    if (item.quantity < 0) {
      throw new InvalidInvoiceError('Quantity must be non-negative');
    }

    // Validate unitPrice
    if (!Number.isFinite(item.unitPrice)) {
      throw new InvalidInvoiceError('Unit price must be a finite number');
    }
    if (item.unitPrice < 0) {
      throw new InvalidInvoiceError('Unit price must be non-negative');
    }

    // Validate taxRate
    if (!Number.isFinite(item.taxRate)) {
      throw new InvalidInvoiceError('Tax rate must be a finite number');
    }
    if (item.taxRate < 0) {
      throw new InvalidInvoiceError('Tax rate must be non-negative');
    }

    // Calculate subtotal (quantity * unitPrice)
    let subtotal = item.quantity * item.unitPrice;
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      // Validate discount value
      if (!Number.isFinite(item.discount.value)) {
        throw new InvalidInvoiceError('Discount value must be a finite number');
      }
      if (item.discount.value < 0) {
        throw new InvalidInvoiceError('Discount value must be non-negative');
      }

      if (item.discount.type === 'percentage') {
        if (item.discount.value > 100) {
          throw new InvalidInvoiceError('Percentage discount cannot exceed 100%');
        }
        discountAmount = subtotal * (item.discount.value / 100);
      } else if (item.discount.type === 'fixed') {
        discountAmount = item.discount.value;
      }
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Validate that discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
      throw new InvalidInvoiceError('Discount cannot exceed subtotal');
    }

    // Calculate taxable amount (subtotal - discountAmount)
    let taxableAmount = subtotal - discountAmount;
    taxableAmount = Math.round(taxableAmount * 100) / 100;

    // Calculate tax amount (apply tax to taxableAmount, not subtotal)
    let taxAmount = taxableAmount * item.taxRate;
    taxAmount = Math.round(taxAmount * 100) / 100;

    // Calculate line total (taxableAmount + taxAmount)
    let total = taxableAmount + taxAmount;
    total = Math.round(total * 100) / 100;

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    });

    totalSubtotal += subtotal;
    totalDiscountAmount += discountAmount;
    totalTaxAmount += taxAmount;
    totalLineTotal += total;
  }

  // Round final totals to cents
  totalSubtotal = Math.round(totalSubtotal * 100) / 100;
  totalDiscountAmount = Math.round(totalDiscountAmount * 100) / 100;
  totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
  totalLineTotal = Math.round(totalLineTotal * 100) / 100;

  return {
    lines,
    subtotal: totalSubtotal,
    totalDiscount: totalDiscountAmount,
    totalTax: totalTaxAmount,
    grandTotal: totalLineTotal
  };
}

export { calculateInvoice, InvalidInvoiceError, type LineItem, type InvoiceResult };