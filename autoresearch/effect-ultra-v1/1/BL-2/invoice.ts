import { Effect } from "effect";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: "percentage" | "fixed"; value: number };
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

function roundTocents(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateLineItem(item: LineItem): Effect.Effect<LineItem, Error> {
  return Effect.gen(function* () {
    if (item.quantity < 0) {
      yield* Effect.fail(new Error("Quantity must be non-negative"));
    }
    if (item.unitPrice < 0) {
      yield* Effect.fail(new Error("Unit price must be non-negative"));
    }
    if (item.taxRate < 0 || item.taxRate > 1) {
      yield* Effect.fail(new Error("Tax rate must be between 0 and 1"));
    }
    if (item.discount && item.discount.value < 0) {
      yield* Effect.fail(new Error("Discount value must be non-negative"));
    }
    return item;
  });
}

function calculateLineItem(
  item: LineItem
): Effect.Effect<
  {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  },
  Error
> {
  return Effect.gen(function* () {
    // Calculate subtotal and round
    const subtotal = roundTocents(item.quantity * item.unitPrice);

    // Calculate discount amount
    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === "percentage") {
        // Clamp percentage to [0, 100] to prevent negative taxable amount
        const percentage = Math.min(Math.max(item.discount.value, 0), 100);
        discountAmount = roundTocents((subtotal * percentage) / 100);
      } else {
        // Fixed discount: cap at subtotal
        discountAmount = roundTocents(Math.min(item.discount.value, subtotal));
      }
    }

    // Calculate taxable amount (subtotal - discount), ensure non-negative
    const taxableAmount = roundTocents(Math.max(subtotal - discountAmount, 0));

    // Tax applied to taxableAmount (not subtotal) - fixes bug_tax_on_discount
    const taxAmount = roundTocents(taxableAmount * item.taxRate);

    // Total = taxableAmount + taxAmount
    const total = roundTocents(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
    };
  }

  const effect = Effect.gen(function* () {
    // Validate all items
    const validatedItems = yield* Effect.all(
      items.map((item) => validateLineItem(item)),
      { concurrency: "unbounded" }
    );

    // Calculate each line
    const calculatedLines = yield* Effect.all(
      validatedItems.map((item) => calculateLineItem(item)),
      { concurrency: "unbounded" }
    );

    // Sum totals from already-rounded line items
    const subtotal = roundTocents(
      calculatedLines.reduce((sum, line) => sum + line.subtotal, 0)
    );
    const totalDiscount = roundTocents(
      calculatedLines.reduce((sum, line) => sum + line.discountAmount, 0)
    );
    const totalTax = roundTocents(
      calculatedLines.reduce((sum, line) => sum + line.taxAmount, 0)
    );
    const grandTotal = roundTocents(
      calculatedLines.reduce((sum, line) => sum + line.total, 0)
    );

    return {
      lines: calculatedLines,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    };
  });

  try {
    return Effect.runSync(effect);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}