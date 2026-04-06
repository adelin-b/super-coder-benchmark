import { Effect, Data } from "effect"

export interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount?: { type: 'percentage' | 'fixed'; value: number }
}

export interface InvoiceResult {
  lines: Array<{
    subtotal: number
    discountAmount: number
    taxableAmount: number
    taxAmount: number
    total: number
  }>
  subtotal: number
  totalDiscount: number
  totalTax: number
  grandTotal: number
}

class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string
}> {}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function validateInputInternal(
  items: LineItem[]
): Effect.Effect<LineItem[], ValidationError> {
  return Effect.gen(function* () {
    if (!Array.isArray(items)) {
      yield* Effect.fail(new ValidationError({ message: "Items must be an array" }))
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (typeof item.quantity !== "number" || item.quantity < 0) {
        yield* Effect.fail(
          new ValidationError({ message: "Quantity must be non-negative" })
        )
      }

      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        yield* Effect.fail(
          new ValidationError({ message: "Unit price must be non-negative" })
        )
      }

      if (typeof item.taxRate !== "number" || item.taxRate < 0) {
        yield* Effect.fail(
          new ValidationError({ message: "Tax rate must be non-negative" })
        )
      }

      if (item.discount) {
        if (typeof item.discount.value !== "number" || item.discount.value < 0) {
          yield* Effect.fail(
            new ValidationError({ message: "Discount value must be non-negative" })
          )
        }

        if (item.discount.type === "percentage" && item.discount.value > 100) {
          yield* Effect.fail(
            new ValidationError({
              message: "Percentage discount cannot exceed 100",
            })
          )
        }
      }
    }

    return items
  })
}

function computeInvoiceInternal(
  items: LineItem[]
): Effect.Effect<InvoiceResult, ValidationError> {
  return Effect.gen(function* () {
    yield* validateInputInternal(items)

    if (items.length === 0) {
      return {
        lines: [],
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
      }
    }

    const lines = items.map((item) => {
      const subtotal = round(item.quantity * item.unitPrice)

      let discountAmount = 0
      if (item.discount) {
        if (item.discount.type === "percentage") {
          discountAmount = round(subtotal * (item.discount.value / 100))
        } else {
          discountAmount = Math.min(item.discount.value, subtotal)
        }
      }
      discountAmount = round(discountAmount)

      const taxableAmount = round(Math.max(0, subtotal - discountAmount))
      const taxAmount = round(taxableAmount * item.taxRate)
      const total = round(taxableAmount + taxAmount)

      return {
        subtotal,
        discountAmount,
        taxableAmount,
        taxAmount,
        total,
      }
    })

    const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0))
    const totalDiscount = round(
      lines.reduce((sum, line) => sum + line.discountAmount, 0)
    )
    const totalTax = round(lines.reduce((sum, line) => sum + line.taxAmount, 0))
    const grandTotal = round(lines.reduce((sum, line) => sum + line.total, 0))

    return {
      lines,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
    }
  })
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  try {
    return Effect.runSync(computeInvoiceInternal(items))
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(e.message)
    }
    throw new Error("Failed to calculate invoice")
  }
}