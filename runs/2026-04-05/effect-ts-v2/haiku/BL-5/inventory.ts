import { Effect, Data, Ref } from "effect"

// Error types
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

// Data types
interface Inventory {
  itemId: string
  name: string
  total: number
  reserved: number
}

interface Reservation {
  reservationId: string
  itemId: string
  quantity: number
  timestamp: number
}

interface InventoryService {
  reserve(
    itemId: string,
    quantity: number
  ): Effect.Effect<string, InsufficientStock | ItemNotFound>
  release(
    reservationId: string
  ): Effect.Effect<void, ReservationNotFound>
  checkAvailability(
    itemId: string
  ): Effect.Effect<number, ItemNotFound>
  getInventory(itemId: string): Effect.Effect<Inventory, ItemNotFound>
  addItem(
    itemId: string,
    name: string,
    quantity: number
  ): Effect.Effect<void>
  restockItem(
    itemId: string,
    quantity: number
  ): Effect.Effect<void, ItemNotFound>
  releaseAll(): Effect.Effect<void>
  getReservations(): Effect.Effect<Reservation[]>
}

export const createInventoryService = (): Effect.Effect<InventoryService> =>
  Effect.gen(function* () {
    const inventories = yield* Ref.make(new Map<string, Inventory>())
    const reservations = yield* Ref.make(new Map<string, Reservation>())
    let reservationCounter = 0

    const service: InventoryService = {
      reserve: (itemId: string, quantity: number) =>
        Effect.gen(function* () {
          const invMap = yield* Ref.get(inventories)
          const inv = invMap.get(itemId)

          if (!inv) {
            yield* Effect.fail(new ItemNotFound({ itemId }))
          }

          const available = inv!.total - inv!.reserved

          if (available < quantity) {
            yield* Effect.fail(
              new InsufficientStock({
                itemId,
                requested: quantity,
                available,
              })
            )
          }

          const reservationId = `RES-${Date.now()}-${++reservationCounter}`
          const reservation: Reservation = {
            reservationId,
            itemId,
            quantity,
            timestamp: Date.now(),
          }

          yield* Ref.update(inventories, (map) => {
            const updated = new Map(map)
            const item = updated.get(itemId)!
            updated.set(itemId, {
              ...item,
              reserved: item.reserved + quantity,
            })
            return updated
          })

          yield* Ref.update(reservations, (map) => {
            const updated = new Map(map)
            updated.set(reservationId, reservation)
            return updated
          })

          return reservationId
        }),

      release: (reservationId: string) =>
        Effect.gen(function* () {
          const resMap = yield* Ref.get(reservations)
          const reservation = resMap.get(reservationId)

          if (!reservation) {
            yield* Effect.fail(new ReservationNotFound({ reservationId }))
          }

          yield* Ref.update(inventories, (map) => {
            const updated = new Map(map)
            const item = updated.get(reservation!.itemId)
            if (item) {
              updated.set(reservation!.itemId, {
                ...item,
                reserved: Math.max(0, item.reserved - reservation!.quantity),
              })
            }
            return updated
          })

          yield* Ref.update(reservations, (map) => {
            const updated = new Map(map)
            updated.delete(reservationId)
            return updated
          })
        }),

      checkAvailability: (itemId: string) =>
        Effect.gen(function* () {
          const invMap = yield* Ref.get(inventories)
          const inv = invMap.get(itemId)

          if (!inv) {
            yield* Effect.fail(new ItemNotFound({ itemId }))
          }

          return inv!.total - inv!.reserved
        }),

      getInventory: (itemId: string) =>
        Effect.gen(function* () {
          const invMap = yield* Ref.get(inventories)
          const inv = invMap.get(itemId)

          if (!inv) {
            yield* Effect.fail(new ItemNotFound({ itemId }))
          }

          return inv!
        }),

      addItem: (itemId: string, name: string, quantity: number) =>
        Effect.gen(function* () {
          yield* Ref.update(inventories, (map) => {
            const updated = new Map(map)
            updated.set(itemId, {
              itemId,
              name,
              total: quantity,
              reserved: 0,
            })
            return updated
          })
        }),

      restockItem: (itemId: string, quantity: number) =>
        Effect.gen(function* () {
          const invMap = yield* Ref.get(inventories)
          const inv = invMap.get(itemId)

          if (!inv) {
            yield* Effect.fail(new ItemNotFound({ itemId }))
          }

          yield* Ref.update(inventories, (map) => {
            const updated = new Map(map)
            updated.set(itemId, {
              ...inv!,
              total: inv!.total + quantity,
            })
            return updated
          })
        }),

      releaseAll: () =>
        Effect.gen(function* () {
          yield* Ref.set(reservations, new Map())
          yield* Ref.update(inventories, (map) => {
            const updated = new Map(map)
            for (const [key, inv] of updated.entries()) {
              updated.set(key, { ...inv, reserved: 0 })
            }
            return updated
          })
        }),

      getReservations: () =>
        Effect.gen(function* () {
          const resMap = yield* Ref.get(reservations)
          return Array.from(resMap.values())
        }),
    }

    return service
  })

export type {
  InventoryService,
  Inventory,
  Reservation,
}
export {
  InsufficientStock,
  ReservationNotFound,
  ItemNotFound,
}