import { Effect, Ref } from "effect"

interface InventoryState {
  [productId: string]: {
    total: number
    reserved: number
  }
}

export class InsufficientStock extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for ${productId}: requested ${requested}, available ${available}`)
    this.name = "InsufficientStock"
  }
}

export class InvalidProductId extends Error {
  constructor() {
    super("Product ID cannot be empty")
    this.name = "InvalidProductId"
  }
}

export class InvalidQuantity extends Error {
  constructor(quantity: number) {
    super(`Quantity must be positive, got ${quantity}`)
    this.name = "InvalidQuantity"
  }
}

export class ProductNotFound extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`)
    this.name = "ProductNotFound"
  }
}

export interface IInventoryReservation {
  setStock(productId: string, quantity: number): void
  reserve(productId: string, quantity: number): void
  release(productId: string, quantity: number): void
  getAvailable(productId: string): number
  getReserved(productId: string): number
  getTotal(productId: string): number
}

class InventoryReservation implements IInventoryReservation {
  private stateRef: Ref.Ref<InventoryState>

  constructor(stateRef: Ref.Ref<InventoryState>) {
    this.stateRef = stateRef
  }

  setStock(productId: string, quantity: number): void {
    this.validateProductId(productId)
    this.validateQuantity(quantity)

    const effect = Ref.update(this.stateRef, (state) => ({
      ...state,
      [productId]: {
        total: quantity,
        reserved: 0,
      },
    }))

    try {
      Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  reserve(productId: string, quantity: number): void {
    this.validateProductId(productId)
    this.validateQuantity(quantity)

    const effect = Ref.get(this.stateRef).pipe(
      Effect.flatMap((state) => {
        const product = state[productId]
        if (!product) {
          return Effect.fail(new ProductNotFound(productId))
        }

        const available = product.total - product.reserved
        if (quantity > available) {
          return Effect.fail(
            new InsufficientStock(productId, quantity, available)
          )
        }

        return Ref.update(this.stateRef, (s) => ({
          ...s,
          [productId]: {
            ...s[productId],
            reserved: s[productId].reserved + quantity,
          },
        }))
      })
    )

    try {
      Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  release(productId: string, quantity: number): void {
    this.validateProductId(productId)
    this.validateQuantity(quantity)

    const effect = Ref.get(this.stateRef).pipe(
      Effect.flatMap((state) => {
        const product = state[productId]
        if (!product) {
          return Effect.fail(new ProductNotFound(productId))
        }

        if (quantity > product.reserved) {
          return Effect.fail(
            new Error(`Cannot release ${quantity}: only ${product.reserved} reserved`)
          )
        }

        return Ref.update(this.stateRef, (s) => ({
          ...s,
          [productId]: {
            ...s[productId],
            reserved: s[productId].reserved - quantity,
          },
        }))
      })
    )

    try {
      Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  getAvailable(productId: string): number {
    this.validateProductId(productId)

    const effect = Ref.get(this.stateRef).pipe(
      Effect.flatMap((state) => {
        const product = state[productId]
        if (!product) {
          return Effect.fail(new ProductNotFound(productId))
        }
        return Effect.succeed(product.total - product.reserved)
      })
    )

    try {
      return Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  getReserved(productId: string): number {
    this.validateProductId(productId)

    const effect = Ref.get(this.stateRef).pipe(
      Effect.flatMap((state) => {
        const product = state[productId]
        if (!product) {
          return Effect.fail(new ProductNotFound(productId))
        }
        return Effect.succeed(product.reserved)
      })
    )

    try {
      return Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  getTotal(productId: string): number {
    this.validateProductId(productId)

    const effect = Ref.get(this.stateRef).pipe(
      Effect.flatMap((state) => {
        const product = state[productId]
        if (!product) {
          return Effect.fail(new ProductNotFound(productId))
        }
        return Effect.succeed(product.total)
      })
    )

    try {
      return Effect.runSync(effect)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  }

  private validateProductId(productId: string): void {
    if (!productId || typeof productId !== "string" || productId.trim() === "") {
      throw new InvalidProductId()
    }
  }

  private validateQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidQuantity(quantity)
    }
  }
}

export function createInventory(): IInventoryReservation {
  const effect = Ref.make<InventoryState>({})
  const stateRef = Effect.runSync(effect)
  return new InventoryReservation(stateRef)
}