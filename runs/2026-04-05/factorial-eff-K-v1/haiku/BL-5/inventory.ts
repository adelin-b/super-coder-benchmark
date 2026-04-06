import { Effect, Ref, Data } from "effect"

class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  itemId: string
  requested: number
  available: number
}> {}

class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  reservationId: string
}> {}

class ItemNotFound extends Data.TaggedError("ItemNotFound")<{
  itemId: string
}> {}

export interface Reservation {
  id: string
  itemId: string
  quantity: number
  timestamp: Date
}

export interface InventoryItem {
  itemId: string
  total: number
  reserved: number
  available: number
}

interface InternalState {
  items: Map<string, { total: number; reserved: number }>
  reservations: Map<string, { itemId: string; quantity: number; timestamp: Date }>
  nextReservationId: number
}

export class InventoryReservationSystem {
  private stateRef: Ref.Ref<InternalState>

  constructor() {
    const initialState: InternalState = {
      items: new Map(),
      reservations: new Map(),
      nextReservationId: 1,
    }
    try {
      this.stateRef = Effect.runSync(Ref.make(initialState))
    } catch (e) {
      throw new Error(`Failed to initialize inventory system: ${String(e)}`)
    }
  }

  addItem(itemId: string, quantity: number): void {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative")
    }
    if (!itemId) {
      throw new Error("Item ID cannot be empty")
    }

    const effect = Ref.update(this.stateRef, (state) => {
      const existing = state.items.get(itemId)
      if (existing) {
        return {
          ...state,
          items: new Map(state.items).set(itemId, {
            total: existing.total + quantity,
            reserved: existing.reserved,
          }),
        }
      }
      return {
        ...state,
        items: new Map(state.items).set(itemId, { total: quantity, reserved: 0 }),
      }
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      throw new Error(`Failed to add item: ${String(e)}`)
    }
  }

  reserve(itemId: string, quantity: number): string {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0")
    }
    if (!itemId) {
      throw new Error("Item ID cannot be empty")
    }

    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const item = state.items.get(itemId)

      if (!item) {
        return yield* Effect.fail(new ItemNotFound({ itemId }))
      }

      const available = item.total - item.reserved
      if (available < quantity) {
        return yield* Effect.fail(
          new InsufficientStock({ itemId, requested: quantity, available })
        )
      }

      const reservationId = `RES-${state.nextReservationId}`
      const newState: InternalState = {
        ...state,
        items: new Map(state.items).set(itemId, {
          total: item.total,
          reserved: item.reserved + quantity,
        }),
        reservations: new Map(state.reservations).set(reservationId, {
          itemId,
          quantity,
          timestamp: new Date(),
        }),
        nextReservationId: state.nextReservationId + 1,
      }

      yield* Ref.set(this.stateRef, newState)
      return reservationId
    })

    try {
      const result = Effect.runSync(effect)
      return result
    } catch (e) {
      if (e instanceof Error && e.message.includes("InsufficientStock")) {
        throw new Error(
          `Insufficient stock for item ${itemId}: requested ${quantity}`
        )
      }
      if (e instanceof Error && e.message.includes("ItemNotFound")) {
        throw new Error(`Item not found: ${itemId}`)
      }
      throw new Error(`Failed to reserve item: ${String(e)}`)
    }
  }

  release(reservationId: string): void {
    if (!reservationId) {
      throw new Error("Reservation ID cannot be empty")
    }

    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const reservation = state.reservations.get(reservationId)

      if (!reservation) {
        return yield* Effect.fail(new ReservationNotFound({ reservationId }))
      }

      const item = state.items.get(reservation.itemId)
      if (!item) {
        return yield* Effect.fail(new ItemNotFound({ itemId: reservation.itemId }))
      }

      const newState: InternalState = {
        ...state,
        items: new Map(state.items).set(reservation.itemId, {
          total: item.total,
          reserved: Math.max(0, item.reserved - reservation.quantity),
        }),
        reservations: new Map(state.reservations),
      }
      newState.reservations.delete(reservationId)

      yield* Ref.set(this.stateRef, newState)
      return void 0
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      if (e instanceof Error && e.message.includes("ReservationNotFound")) {
        throw new Error(`Reservation not found: ${reservationId}`)
      }
      throw new Error(`Failed to release reservation: ${String(e)}`)
    }
  }

  getAvailability(itemId: string): InventoryItem {
    if (!itemId) {
      throw new Error("Item ID cannot be empty")
    }

    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const item = state.items.get(itemId)

      if (!item) {
        return yield* Effect.fail(new ItemNotFound({ itemId }))
      }

      return {
        itemId,
        total: item.total,
        reserved: item.reserved,
        available: item.total - item.reserved,
      }
    })

    try {
      return Effect.runSync(effect)
    } catch (e) {
      if (e instanceof Error && e.message.includes("ItemNotFound")) {
        throw new Error(`Item not found: ${itemId}`)
      }
      throw new Error(`Failed to get availability: ${String(e)}`)
    }
  }

  checkAvailable(itemId: string, quantity: number): boolean {
    if (!itemId) {
      throw new Error("Item ID cannot be empty")
    }
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative")
    }

    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const item = state.items.get(itemId)

      if (!item) {
        return false
      }

      const available = item.total - item.reserved
      return available >= quantity
    })

    try {
      return Effect.runSync(effect)
    } catch (e) {
      throw new Error(`Failed to check availability: ${String(e)}`)
    }
  }

  getReservation(reservationId: string): Reservation {
    if (!reservationId) {
      throw new Error("Reservation ID cannot be empty")
    }

    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const res = state.reservations.get(reservationId)

      if (!res) {
        return yield* Effect.fail(new ReservationNotFound({ reservationId }))
      }

      return {
        id: reservationId,
        itemId: res.itemId,
        quantity: res.quantity,
        timestamp: res.timestamp,
      }
    })

    try {
      return Effect.runSync(effect)
    } catch (e) {
      if (e instanceof Error && e.message.includes("ReservationNotFound")) {
        throw new Error(`Reservation not found: ${reservationId}`)
      }
      throw new Error(`Failed to get reservation: ${String(e)}`)
    }
  }

  getAllReservations(): Reservation[] {
    const effect = Effect.gen(function* () {
      const state = yield* Ref.get(this.stateRef)
      const reservations: Reservation[] = []

      for (const [id, res] of state.reservations) {
        reservations.push({
          id,
          itemId: res.itemId,
          quantity: res.quantity,
          timestamp: res.timestamp,
        })
      }

      return reservations
    })

    try {
      return Effect.runSync(effect)
    } catch (e) {
      throw new Error(`Failed to get reservations: ${String(e)}`)
    }
  }

  clear(): void {
    const effect = Ref.set(this.stateRef, {
      items: new Map(),
      reservations: new Map(),
      nextReservationId: 1,
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      throw new Error(`Failed to clear inventory: ${String(e)}`)
    }
  }
}