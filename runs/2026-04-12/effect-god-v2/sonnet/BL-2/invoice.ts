import { Effect, Data } from "effect";
import { Exit, Cause } from "effect";

// --- Domain Types ---

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: { type: "percentage" | "fixed"; value: number };
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

// --- Internal Errors ---

class InvalidLineItemError extends Data.TaggedError("InvalidLineItemError")<{
  reason: string;
}> {}

// --- Internal Helpers ---

const round2 = (n: number): number => Math.round(n * 100) / 100;

const computeLine = (
  item: LineItem
): Effect.Effect<
  {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  },
  InvalidLineItemError
> =>
  Effect.gen(function* () {
    if (item.quantity < 0) {
      yield* Effect.fail(
        new InvalidLineItemError({ reason: "quantity must be non-negative" })
      );
    }
    if (item.unitPrice < 0) {
      yield* Effect.fail(
        new InvalidLineItemError({ reason: "unitPrice must be non-negative" })
      );
    }
    if (item.taxRate < 0) {
      yield* Effect.fail(
        new InvalidLineItemError({ reason: "taxRate must be non-negative" })
      );
    }

    const subtotal = round2(item.quantity * item.unitPrice);

    let discountAmount = 0;
    if (item.discount) {
      if (item.discount.type === "percentage") {
        // Clamp percentage to [0, 100] to prevent negative taxableAmount
        const pct = Math.min(Math.max(item.discount.value, 0), 100);
        discountAmount = round2(subtotal * (pct / 100));
      } else {
        // fixed discount — must not be negative, clamp to subtotal
        const fixedVal = Math.max(item.discount.value, 0);
        discountAmount = round2(Math.min(fixedVal, subtotal));
      }
    }

    // taxableAmount must be >= 0
    const taxableAmount = round2(Math.max(subtotal - discountAmount, 0));

    // Tax applied to taxableAmount (not subtotal) — fix tax_on_discount bug
    const taxAmount = round2(taxableAmount * item.taxRate);

    const total = round2(taxableAmount + taxAmount);

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    };
  });

const computeInvoice = (
  items: LineItem[]
): Effect.Effect<InvoiceResult, InvalidLineItemError> =>
  Effect.gen(function* () {
    const lines: InvoiceResult["lines"] = [];

    for (const item of items) {
      const line = yield* computeLine(item);
      lines.push(line);
    }

    const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
    const totalDiscount = round2(
      lines.reduce((sum, l) => sum + l.discountAmount, 0)
    );
    const totalTax = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
    // grandTotal === sum of line totals (invariant 1)
    const grandTotal = round2(lines.reduce((sum, l) => sum + l.total, 0));

    return {
      lines,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    };
  });

// --- Exported Public API ---

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) {
    // Return a zero-value result for empty array rather than throwing
    return {
      lines: [],
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
    };
  }

  const exit = Effect.runSyncExit(computeInvoice(items));

  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }

  return exit.value;
}

export type { LineItem, InvoiceResult };