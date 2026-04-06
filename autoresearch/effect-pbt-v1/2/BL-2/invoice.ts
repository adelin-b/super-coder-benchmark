interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount?: { type: "percentage" | "fixed"; value: number }
}

interface InvoiceResult {
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

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateInvoice(items: LineItem[]): InvoiceResult {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items array must not be empty")
  }

  const lines: InvoiceResult["lines"] = []

  for (const item of items) {
    if (typeof item.quantity !== "number" || item.quantity < 0) {
      throw new Error("Quantity must be a non-negative number")
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      throw new Error("Unit price must be a non-negative number")
    }
    if (typeof item.taxRate !== "number" || item.taxRate < 0) {
      throw new Error("Tax rate must be a non-negative number")
    }
    if (item.discount) {
      if (typeof item.discount.value !== "number" || item.discount.value < 0) {
        throw new Error("Discount value must be a non-negative number")
      }
    }

    const subtotal = round(item.quantity * item.unitPrice)

    let discountAmount = 0
    if (item.discount) {
      if (item.discount.type === "percentage") {
        discountAmount = round(subtotal * (item.discount.value / 100))
      } else if (item.discount.type === "fixed") {
        discountAmount = round(item.discount.value)
      }
    }

    discountAmount = Math.min(discountAmount, subtotal)

    const taxableAmount = round(subtotal - discountAmount)

    const taxAmount = round(taxableAmount * item.taxRate)

    const total = round(taxableAmount + taxAmount)

    lines.push({
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total,
    })
  }

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
}

export type { LineItem, InvoiceResult }