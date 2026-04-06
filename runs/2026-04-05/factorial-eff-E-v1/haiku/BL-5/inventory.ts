import { Effect, Ref, Data } from "effect"

// Domain errors
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

// Internal state
interface Reservation {
  id: string
  itemId: string
  quantity: number
  timestamp: number
}

interface InventoryItem {
  itemId: string
  totalCapacity: number
  reserved: number
}

// Public interface
export interface InventoryManager {
  reserve(itemId: string, quantity: number): string
  release(reservationId: string): void
  checkAvailability(itemId: string): number
  getCapacity(itemId: string): number
  addItem(itemId: string, capacity: number): void
}

export function createInventoryManager(): InventoryManager {
  let reservationCounter = 0
  const itemsRef = Ref.unsafeMake<Map<string, InventoryItem>>(new Map())
  const reservationsRef = Ref.unsafeMake<Map<string, Reservation>>(new Map())

  const reserve = (itemId: string, quantity: number): string =>
    Effect.runSync(
      Effect.gen(function* () {
        const items = yield* Ref.get(itemsRef)
        const item = items.get(itemId)

        if (!item) {
          throw new ItemNotFound({ itemId })
        }

        const available = item.totalCapacity - item.reserved
        if (available < quantity) {
          throw new InsufficientStock({
            itemId,
            requested: quantity,
            available,
          })
        }

        const reservationId = `RES-${++reservationCounter}-${Date.now()}`
        const reservation: Reservation = {
          id: reservationId,
          itemId,
          quantity,
          timestamp: Date.now(),
        }

        yield* Ref.update(itemsRef, (map) => {
          const updated = new Map(map)
          updated.set(itemId, {
            ...item,
            reserved: item.reserved + quantity,
          })
          return updated
        })

        yield* Ref.update(reservationsRef, (map) => {
          const updated = new Map(map)
          updated.set(reservationId, reservation)
          return updated
        })

        return reservationId
      })
    )

  const release = (reservationId: string): void => {
    try {
      Effect.runSync(
        Effect.gen(function* () {
          const reservations = yield* Ref.get(reservationsRef)
          const reservation = reservations.get(reservationId)

          if (!reservation) {
            throw new ReservationNotFound({ reservationId })
          }

          const items = yield* Ref.get(itemsRef)
          const item = items.get(reservation.itemId)

          if (item) {
            yield* Ref.update(itemsRef, (map) => {
              const updated = new Map(map)
              updated.set(reservation.itemId, {
                ...item,
                reserved: Math.max(0, item.reserved - reservation.quantity),
              })
              return updated
            })
          }

          yield* Ref.update(reservationsRef, (map) => {
            const updated = new Map(map)
            updated.delete(reservationId)
            return updated
          })
        })
      )
    } catch (e) {
      if (e instanceof ReservationNotFound) {
        throw new Error(`Reservation not found: ${e.reservationId}`)
      }
      throw e
    }
  }

  const checkAvailability = (itemId: string): number => {
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const items = yield* Ref.get(itemsRef)
          const item = items.get(itemId)

          if (!item) {
            throw new ItemNotFound({ itemId })
          }

          return item.totalCapacity - item.reserved
        })
      )
    } catch (e) {
      if (e instanceof ItemNotFound) {
        throw new Error(`Item not found: ${e.itemId}`)
      }
      throw e
    }
  }

  const getCapacity = (itemId: string): number => {
    try {
      return Effect.runSync(
        Effect.gen(function* () {
          const items = yield* Ref.get(itemsRef)
          const item = items.get(itemId)

          if (!item) {
            throw new ItemNotFound({ itemId })
          }

          return item.totalCapacity
        })
      )
    } catch (e) {
      if (e instanceof ItemNotFound) {
        throw new Error(`Item not found: ${e.itemId}`)
      }
      throw e
    }
  }

  const addItem = (itemId: string, capacity: number): void => {
    Effect.runSync(
      Ref.update(itemsRef, (map) => {
        const updated = new Map(map)
        updated.set(itemId, {
          itemId,
          totalCapacity: capacity,
          reserved: 0,
        })
        return updated
      })
    )
  }

  return {
    reserve,
    release,
    checkAvailability,
    getCapacity,
    addItem,
  }
}