import { Effect, Data, Exit, Cause } from "effect";

// ─── Internal tagged errors ───────────────────────────────────────────────────

class InvoiceError extends Data.TaggedError("InvoiceError")<{ reason: string }> {}

// ─── Public error class ───────────────────────────────────────────────────────

export class InvoiceCalculationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InvoiceCalculationError";
    Object.setPrototypeOf(this, InvoiceCalculationError.prototype);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Internal Effect logic ────────────────────────────────────────────────────

const calculateInvoiceEffect = (
  items: LineItem[]
): Effect.Effect<InvoiceResult, InvoiceError> =>
  Effect.gen(function* () {
    // Validate inputs
    for (const item of items) {
      if (item.quantity < 0) {
        yield* Effect.fail(new InvoiceError({ reason: "Quantity cannot be negative" }));
      }
      if (item.unitPrice < 0) {
        yield* Effect.fail(new InvoiceError({ reason: "Unit price cannot be negative" }));
      }
      if (item.taxRate < 0) {
        yield* Effect.fail(new InvoiceError({ reason: "Tax rate cannot be negative" }));
      }
      if (item.discount) {
        if (item.discount.value < 0) {
          yield* Effect.fail(new InvoiceError({ reason: "Discount value cannot be negative" }));
        }
        if (item.discount.type === "percentage" && item.discount.value > 100) {
          yield* Effect.fail(new InvoiceError({ reason: "Percentage discount cannot exceed 100%" }));
        }
      }
    }

    const lines: InvoiceResult["lines"] = [];

    for (const item of items) {
      // subtotal = quantity * unitPrice, rounded per line
      const subtotal = round2(item.quantity * item.unitPrice);

      // discount amount
      let discountAmount: number;
      if (!item.discount) {
        discountAmount = 0;
      } else if (item.discount.type === "percentage") {
        discountAmount = round2(subtotal * (item.discount.value / 100));
      } else {
        // fixed — cap at subtotal so taxableAmount >= 0
        discountAmount = round2(Math.min(item.discount.value, subtotal));
      }

      // taxableAmount = subtotal - discountAmount, clamped to >= 0
      const taxableAmount = round2(Math.max(0, subtotal - discountAmount));

      // tax applied to taxableAmount (correct — not on subtotal)
      const taxAmount = round2(taxableAmount * item.taxRate);

      // line total
      const total = round2(taxableAmount + taxAmount);

      lines.push({ subtotal, discountAmount, taxableAmount, taxAmount, total });
    }

    const subtotal = round2(lines.reduce((acc, l) => acc + l.subtotal, 0));
    const totalDiscount = round2(lines.reduce((acc, l) => acc + l.discountAmount, 0));
    const totalTax = round2(lines.reduce((acc, l) => acc + l.taxAmount, 0));
    const grandTotal = round2(lines.reduce((acc, l) => acc + l.total, 0));

    return { lines, subtotal, totalDiscount, totalTax, grandTotal };
  });

// ─── Public export ────────────────────────────────────────────────────────────

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items)) {
    throw new InvoiceCalculationError("Items must be an array");
  }

  const exit = Effect.runSyncExit(calculateInvoiceEffect(items));

  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    const msg =
      raw instanceof Error
        ? raw.message
        : typeof (raw as any).reason === "string"
        ? (raw as any).reason
        : String(raw);
    throw new InvoiceCalculationError(msg);
  }

  return exit.value;
}