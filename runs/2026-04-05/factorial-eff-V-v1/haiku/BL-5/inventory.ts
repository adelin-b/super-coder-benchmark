import { Effect, Ref } from "effect"

interface InventoryItem {
  readonly id: string
  readonly available: number
  readonly reserved: number
}

class ItemNotFound extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`)
    this.name = "ItemNotFound"
  }
}

class InsufficientStock extends Error {
  constructor(itemId: string, available: number, requested: number) {
    super(
      `Insufficient stock for ${itemId}: available=${available}, requested=${requested}`
    )
    this.name = "InsufficientStock"
  }
}

class InvalidQuantity extends Error {
  constructor(reason: string) {
    super(`Invalid quantity: ${reason}`)
    this.name = "InvalidQuantity"
  }
}

class ItemAlreadyExists extends Error {
  constructor(itemId: string) {
    super(`Item already exists: ${itemId}`)
    this.name = "ItemAlreadyExists"
  }
}

class InvalidReservedRelease extends Error {
  constructor(itemId: string, reserved: number, requested: number) {
    super(
      `Cannot release ${requested} of item ${itemId}: only ${reserved} reserved`
    )
    this.name = "InvalidReservedRelease"
  }
}

export class Inventory {
  private state: Ref.Ref<Map<string, { available: number; reserved: number }>>

  constructor() {
    this.state = Ref.unsafeMake(new Map())
  }

  create(itemId: string, quantity: number): InventoryItem {
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new InvalidQuantity("must be an integer")
    }
    if (quantity < 0) {
      throw new InvalidQuantity("cannot be negative")
    }

    const state = this.state
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const map = yield* Ref.get(state)
          if (map.has(itemId)) {
            throw new ItemAlreadyExists(itemId)
          }
          map.set(itemId, { available: quantity, reserved: 0 })
          return {
            id: itemId,
            available: quantity,
            reserved: 0,
          } as InventoryItem
        })
      )
    } catch (e) {
      if (
        e instanceof ItemAlreadyExists ||
        e instanceof InvalidQuantity
      ) {
        throw e
      }
      throw new Error(String(e))
    }
  }

  reserve(itemId: string, quantity: number): InventoryItem {
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new InvalidQuantity("must be an integer")
    }
    if (quantity <= 0) {
      throw new InvalidQuantity("must be positive")
    }

    const state = this.state
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const map = yield* Ref.get(state)
          const item = map.get(itemId)
          if (!item) {
            throw new ItemNotFound(itemId)
          }
          if (item.available < quantity) {
            throw new InsufficientStock(itemId, item.available, quantity)
          }
          item.available -= quantity
          item.reserved += quantity
          return {
            id: itemId,
            available: item.available,
            reserved: item.reserved,
          } as InventoryItem
        })
      )
    } catch (e) {
      if (
        e instanceof ItemNotFound ||
        e instanceof InsufficientStock ||
        e instanceof InvalidQuantity
      ) {
        throw e
      }
      throw new Error(String(e))
    }
  }

  release(itemId: string, quantity: number): InventoryItem {
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new InvalidQuantity("must be an integer")
    }
    if (quantity <= 0) {
      throw new InvalidQuantity("must be positive")
    }

    const state = this.state
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const map = yield* Ref.get(state)
          const item = map.get(itemId)
          if (!item) {
            throw new ItemNotFound(itemId)
          }
          if (item.reserved < quantity) {
            throw new InvalidReservedRelease(itemId, item.reserved, quantity)
          }
          item.available += quantity
          item.reserved -= quantity
          return {
            id: itemId,
            available: item.available,
            reserved: item.reserved,
          } as InventoryItem
        })
      )
    } catch (e) {
      if (
        e instanceof ItemNotFound ||
        e instanceof InvalidReservedRelease ||
        e instanceof InvalidQuantity
      ) {
        throw e
      }
      throw new Error(String(e))
    }
  }

  getAvailability(itemId: string): InventoryItem {
    const state = this.state
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const map = yield* Ref.get(state)
          const item = map.get(itemId)
          if (!item) {
            throw new ItemNotFound(itemId)
          }
          return {
            id: itemId,
            available: item.available,
            reserved: item.reserved,
          } as InventoryItem
        })
      )
    } catch (e) {
      if (e instanceof ItemNotFound) {
        throw e
      }
      throw new Error(String(e))
    }
  }

  addStock(itemId: string, quantity: number): InventoryItem {
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new InvalidQuantity("must be an integer")
    }
    if (quantity < 0) {
      throw new InvalidQuantity("cannot be negative")
    }

    const state = this.state
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const map = yield* Ref.get(state)
          const item = map.get(itemId)
          if (!item) {
            throw new ItemNotFound(itemId)
          }
          item.available += quantity
          return {
            id: itemId,
            available: item.available,
            reserved: item.reserved,
          } as InventoryItem
        })
      )
    } catch (e) {
      if (
        e instanceof ItemNotFound ||
        e instanceof InvalidQuantity
      ) {
        throw e
      }
      throw new Error(String(e))
    }
  }
}

export type { InventoryItem }
export {
  ItemNotFound,
  InsufficientStock,
  InvalidQuantity,
  ItemAlreadyExists,
  InvalidReservedRelease,
}