export interface ReservationToken {
  readonly itemId: string
  readonly quantity: number
  readonly reservedAt: Date
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      `Insufficient stock for ${itemId}: ${available} available, ${requested} requested`
    )
    this.name = "InsufficientStockError"
  }
}

export class ItemNotFoundError extends Error {
  constructor(public readonly itemId: string) {
    super(`Item not found: ${itemId}`)
    this.name = "ItemNotFoundError"
  }
}

export class InvalidQuantityError extends Error {
  constructor(reason: string) {
    super(`Invalid quantity: ${reason}`)
    this.name = "InvalidQuantityError"
  }
}

export class Inventory {
  private stock: Map<string, number> = new Map()
  private reserved: Map<string, number> = new Map()

  addStock(itemId: string, quantity: number): void {
    if (typeof quantity !== "number" || quantity <= 0) {
      throw new InvalidQuantityError("Quantity must be a positive number")
    }
    const current = this.stock.get(itemId) ?? 0
    this.stock.set(itemId, current + quantity)
  }

  reserve(itemId: string, quantity: number): ReservationToken {
    if (typeof quantity !== "number" || quantity <= 0) {
      throw new InvalidQuantityError("Quantity must be a positive number")
    }

    const total = this.stock.get(itemId)
    if (total === undefined) {
      throw new ItemNotFoundError(itemId)
    }

    const reservedAmount = this.reserved.get(itemId) ?? 0
    const available = total - reservedAmount

    if (available < quantity) {
      throw new InsufficientStockError(itemId, available, quantity)
    }

    this.reserved.set(itemId, reservedAmount + quantity)

    return {
      itemId,
      quantity,
      reservedAt: new Date(),
    }
  }

  release(token: ReservationToken): void {
    if (!token || typeof token.quantity !== "number" || token.quantity <= 0) {
      throw new InvalidQuantityError("Invalid reservation token")
    }

    const reservedAmount = this.reserved.get(token.itemId) ?? 0

    if (reservedAmount < token.quantity) {
      throw new Error(
        `Cannot release ${token.quantity} from ${token.itemId}: only ${reservedAmount} reserved`
      )
    }

    this.reserved.set(token.itemId, reservedAmount - token.quantity)
  }

  checkAvailable(itemId: string): number {
    const total = this.stock.get(itemId)
    if (total === undefined) {
      throw new ItemNotFoundError(itemId)
    }
    const reservedAmount = this.reserved.get(itemId) ?? 0
    return total - reservedAmount
  }

  getTotalStock(itemId: string): number {
    const total = this.stock.get(itemId)
    if (total === undefined) {
      throw new ItemNotFoundError(itemId)
    }
    return total
  }

  getReservedAmount(itemId: string): number {
    const total = this.stock.get(itemId)
    if (total === undefined) {
      throw new ItemNotFoundError(itemId)
    }
    return this.reserved.get(itemId) ?? 0
  }

  itemExists(itemId: string): boolean {
    return this.stock.has(itemId)
  }
}