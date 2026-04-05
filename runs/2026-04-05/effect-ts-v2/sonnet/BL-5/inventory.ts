import { Context, Data, Effect, Layer, Ref, Schema } from "effect"
import { assign, fromPromise, setup } from "xstate"

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const InventoryItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  totalQuantity: Schema.Number,
  reservedQuantity: Schema.Number,
})

export const ReservationSchema = Schema.Struct({
  id: Schema.String,
  itemId: Schema.String,
  quantity: Schema.Number,
  createdAt: Schema.Number,
})

export type InventoryItem = Schema.Schema.Type<typeof InventoryItemSchema>
export type Reservation = Schema.Schema.Type<typeof ReservationSchema>

export type AvailabilityInfo = {
  readonly itemId: string
  readonly name: string
  readonly totalQuantity: number
  readonly reservedQuantity: number
  readonly availableQuantity: number
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ItemNotFound extends Data.TaggedError("ItemNotFound")<{
  readonly itemId: string
}> {}

export class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  readonly itemId: string
  readonly requested: number
  readonly available: number
}> {}

export class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  readonly reservationId: string
}> {}

export class InvalidQuantity extends Data.TaggedError("InvalidQuantity")<{
  readonly quantity: number
  readonly reason: string
}> {}

export class DuplicateItem extends Data.TaggedError("DuplicateItem")<{
  readonly itemId: string
}> {}

// ─── Internal Store ───────────────────────────────────────────────────────────

type InventoryStore = {
  readonly items: Map<string, InventoryItem>
  readonly reservations: Map<string, Reservation>
}

// ─── Service Tag ─────────────────────────────────────────────────────────────

export class InventoryService extends Context.Tag("InventoryService")<
  InventoryService,
  { readonly store: Ref.Ref<InventoryStore> }
>() {}

export const makeInventoryService = (initialItems: ReadonlyArray<InventoryItem> = []) =>
  Effect.gen(function* () {
    const items = new Map(initialItems.map((item) => [item.id, item]))
    const store = yield* Ref.make<InventoryStore>({ items, reservations: new Map() })
    return { store }
  })

export const InventoryServiceLive = (initialItems: ReadonlyArray<InventoryItem> = []) =>
  Layer.effect(InventoryService, makeInventoryService(initialItems))

// ─── addItem ─────────────────────────────────────────────────────────────────

export const addItem = (raw: InventoryItem) =>
  Effect.gen(function* () {
    const item = Schema.decodeSync(InventoryItemSchema)(raw)
    const { store } = yield* InventoryService

    type Result = { readonly ok: true } | { readonly ok: false; readonly error: "duplicate" }

    const result = yield* Ref.modify(store, (state): [Result, InventoryStore] => {
      if (state.items.has(item.id)) {
        return [{ ok: false, error: "duplicate" }, state]
      }
      const newItems = new Map(state.items)
      newItems.set(item.id, item)
      return [{ ok: true }, { ...state, items: newItems }]
    })

    if (!result.ok) {
      return yield* Effect.fail(new DuplicateItem({ itemId: item.id }))
    }

    return item
  })

// ─── checkAvailability ───────────────────────────────────────────────────────

export const checkAvailability = (
  itemId: string,
): Effect.Effect<AvailabilityInfo, ItemNotFound, InventoryService> =>
  Effect.gen(function* () {
    const { store } = yield* InventoryService
    const state = yield* Ref.get(store)
    const item = state.items.get(itemId)
    if (!item) {
      return yield* Effect.fail(new ItemNotFound({ itemId }))
    }
    return {
      itemId,
      name: item.name,
      totalQuantity: item.totalQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.totalQuantity - item.reservedQuantity,
    }
  })

// ─── reserve ─────────────────────────────────────────────────────────────────

export const reserve = (
  itemId: string,
  quantity: number,
  reservationId: string = crypto.randomUUID(),
): Effect.Effect<
  Reservation,
  ItemNotFound | InsufficientStock | InvalidQuantity,
  InventoryService
> =>
  Effect.gen(function* () {
    if (quantity <= 0) {
      return yield* Effect.fail(
        new InvalidQuantity({ quantity, reason: "Quantity must be a positive integer" }),
      )
    }

    const { store } = yield* InventoryService

    type ModifyResult =
      | { readonly ok: true; readonly reservation: Reservation }
      | { readonly ok: false; readonly error: "notFound" }
      | { readonly ok: false; readonly error: "insufficient"; readonly available: number }

    const result = yield* Ref.modify(store, (state): [ModifyResult, InventoryStore] => {
      const item = state.items.get(itemId)
      if (!item) {
        return [{ ok: false, error: "notFound" }, state]
      }
      const available = item.totalQuantity - item.reservedQuantity
      if (available < quantity) {
        return [{ ok: false, error: "insufficient", available }, state]
      }
      const updatedItem: InventoryItem = {
        ...item,
        reservedQuantity: item.reservedQuantity + quantity,
      }
      const reservation: Reservation = {
        id: reservationId,
        itemId,
        quantity,
        createdAt: Date.now(),
      }
      const newItems = new Map(state.items)
      newItems.set(itemId, updatedItem)
      const newReservations = new Map(state.reservations)
      newReservations.set(reservationId, reservation)
      return [{ ok: true, reservation }, { items: newItems, reservations: newReservations }]
    })

    if (!result.ok) {
      if (result.error === "notFound") {
        return yield* Effect.fail(new ItemNotFound({ itemId }))
      }
      return yield* Effect.fail(
        new InsufficientStock({ itemId, requested: quantity, available: result.available }),
      )
    }

    return result.reservation
  })

// ─── release ─────────────────────────────────────────────────────────────────

export const release = (
  reservationId: string,
): Effect.Effect<Reservation, ReservationNotFound, InventoryService> =>
  Effect.gen(function* () {
    const { store } = yield* InventoryService

    type ModifyResult =
      | { readonly ok: true; readonly reservation: Reservation }
      | { readonly ok: false; readonly error: "notFound" }

    const result = yield* Ref.modify(store, (state): [ModifyResult, InventoryStore] => {
      const reservation = state.reservations.get(reservationId)
      if (!reservation) {
        return [{ ok: false, error: "notFound" }, state]
      }
      const item = state.items.get(reservation.itemId)
      if (!item) {
        return [{ ok: false, error: "notFound" }, state]
      }
      const updatedItem: InventoryItem = {
        ...item,
        reservedQuantity: Math.max(0, item.reservedQuantity - reservation.quantity),
      }
      const newItems = new Map(state.items)
      newItems.set(reservation.itemId, updatedItem)
      const newReservations = new Map(state.reservations)
      newReservations.delete(reservationId)
      return [{ ok: true, reservation }, { items: newItems, reservations: newReservations }]
    })

    if (!result.ok) {
      return yield* Effect.fail(new ReservationNotFound({ reservationId }))
    }

    return result.reservation
  })

// ─── getReservation ───────────────────────────────────────────────────────────

export const getReservation = (
  reservationId: string,
): Effect.Effect<Reservation, ReservationNotFound, InventoryService> =>
  Effect.gen(function* () {
    const { store } = yield* InventoryService
    const state = yield* Ref.get(store)
    const reservation = state.reservations.get(reservationId)
    if (!reservation) {
      return yield* Effect.fail(new ReservationNotFound({ reservationId }))
    }
    return reservation
  })

// ─── bulkReserve ──────────────────────────────────────────────────────────────

export const bulkReserve = (
  requests: ReadonlyArray<{ readonly itemId: string; readonly quantity: number }>,
): Effect.Effect<
  ReadonlyArray<Reservation>,
  ItemNotFound | InsufficientStock | InvalidQuantity,
  InventoryService
> =>
  Effect.gen(function* () {
    for (const { itemId, quantity } of requests) {
      if (quantity <= 0) {
        return yield* Effect.fail(
          new InvalidQuantity({
            quantity,
            reason: `Item "${itemId}": quantity must be a positive integer`,
          }),
        )
      }
    }

    const { store } = yield* InventoryService

    type BulkResult =
      | { readonly ok: true; readonly reservations: ReadonlyArray<Reservation> }
      | { readonly ok: false; readonly error: "notFound"; readonly itemId: string }
      | {
          readonly ok: false
          readonly error: "insufficient"
          readonly itemId: string
          readonly requested: number
          readonly available: number
        }

    const result = yield* Ref.modify(store, (state): [BulkResult, InventoryStore] => {
      // Aggregate totals per item to check in one pass
      const totals = new Map<string, number>()
      for (const { itemId, quantity } of requests) {
        totals.set(itemId, (totals.get(itemId) ?? 0) + quantity)
      }

      // Read-phase: validate all before touching state
      for (const [itemId, totalRequested] of totals) {
        const item = state.items.get(itemId)
        if (!item) {
          return [{ ok: false, error: "notFound", itemId }, state]
        }
        const available = item.totalQuantity - item.reservedQuantity
        if (available < totalRequested) {
          return [
            { ok: false, error: "insufficient", itemId, requested: totalRequested, available },
            state,
          ]
        }
      }

      // Write-phase: apply all atomically
      const newItems = new Map(state.items)
      const newReservations = new Map(state.reservations)
      const created: Reservation[] = []

      for (const { itemId, quantity } of requests) {
        const item = newItems.get(itemId)!
        newItems.set(itemId, { ...item, reservedQuantity: item.reservedQuantity + quantity })
        const reservation: Reservation = {
          id: crypto.randomUUID(),
          itemId,
          quantity,
          createdAt: Date.now(),
        }
        newReservations.set(reservation.id, reservation)
        created.push(reservation)
      }

      return [{ ok: true, reservations: created }, { items: newItems, reservations: newReservations }]
    })

    if (!result.ok) {
      if (result.error === "notFound") {
        return yield* Effect.fail(new ItemNotFound({ itemId: result.itemId }))
      }
      return yield* Effect.fail(
        new InsufficientStock({
          itemId: result.itemId,
          requested: result.requested,
          available: result.available,
        }),
      )
    }

    return result.reservations
  })

// ─── listReservations ─────────────────────────────────────────────────────────

export const listReservations = (
  itemId?: string,
): Effect.Effect<ReadonlyArray<Reservation>, never, InventoryService> =>
  Effect.gen(function* () {
    const { store } = yield* InventoryService
    const state = yield* Ref.get(store)
    const all = Array.from(state.reservations.values())
    return itemId === undefined ? all : all.filter((r) => r.itemId === itemId)
  })

// ─── XState Machine ───────────────────────────────────────────────────────────

type ReservationMachineContext = {
  readonly itemId: string | null
  readonly quantity: number
  readonly reservationId: string | null
  readonly availableQuantity: number | null
  readonly error: string | null
  readonly checkFn: (itemId: string, quantity: number) => Promise<number>
  readonly reserveFn: (itemId: string, quantity: number) => Promise<string>
  readonly releaseFn: (reservationId: string) => Promise<void>
}

type ReservationMachineEvent =
  | { type: "RESERVE"; itemId: string; quantity: number }
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "RELEASE" }
  | { type: "RETRY" }

type ReservationMachineInput = {
  readonly checkFn: (itemId: string, quantity: number) => Promise<number>
  readonly reserveFn: (itemId: string, quantity: number) => Promise<string>
  readonly releaseFn: (reservationId: string) => Promise<void>
}

export const reservationMachine = setup({
  types: {
    context: {} as ReservationMachineContext,
    events: {} as ReservationMachineEvent,
    input: {} as ReservationMachineInput,
  },
  actors: {
    checkStock: fromPromise(
      async ({
        input,
      }: {
        input: {
          checkFn: (itemId: string, quantity: number) => Promise<number>
          itemId: string
          quantity: number
        }
      }) => {
        const available = await input.checkFn(input.itemId, input.quantity)
        return { available }
      },
    ),
    createReservation: fromPromise(
      async ({
        input,
      }: {
        input: {
          reserveFn: (itemId: string, quantity: number) => Promise<string>
          itemId: string
          quantity: number
        }
      }) => {
        const reservationId = await input.reserveFn(input.itemId, input.quantity)
        return { reservationId }
      },
    ),
    releaseReservation: fromPromise(
      async ({
        input,
      }: {
        input: {
          releaseFn: (reservationId: string) => Promise<void>
          reservationId: string
        }
      }) => {
        await input.releaseFn(input.reservationId)
      },
    ),
  },
}).createMachine({
  id: "inventoryReservation",
  initial: "idle",
  context: ({ input }) => ({
    itemId: null,
    quantity: 0,
    reservationId: null,
    availableQuantity: null,
    error: null,
    checkFn: input.checkFn,
    reserveFn: input.reserveFn,
    releaseFn: input.releaseFn,
  }),
  states: {
    idle: {
      on: {
        RESERVE: {
          target: "checkingAvailability",
          actions: assign({
            itemId: ({ event }) => event.itemId,
            quantity: ({ event }) => event.quantity,
            error: () => null,
            reservationId: () => null,
            availableQuantity: () => null,
          }),
        },
      },
    },

    checkingAvailability: {
      invoke: {
        src: "checkStock",
        input: ({ context }) => ({
          checkFn: context.checkFn,
          itemId: context.itemId!,
          quantity: context.quantity,
        }),
        onDone: {
          target: "available",
          actions: assign({
            availableQuantity: ({ event }) => event.output.available,
          }),
        },
        onError: {
          target: "unavailable",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    available: {
      on: {
        CONFIRM: { target: "reserving" },
        CANCEL: { target: "idle" },
      },
    },

    reserving: {
      invoke: {
        src: "createReservation",
        input: ({ context }) => ({
          reserveFn: context.reserveFn,
          itemId: context.itemId!,
          quantity: context.quantity,
        }),
        onDone: {
          target: "reserved",
          actions: assign({
            reservationId: ({ event }) => event.output.reservationId,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    reserved: {
      on: {
        RELEASE: { target: "releasing" },
        CANCEL: { target: "releasing" },
      },
    },

    releasing: {
      invoke: {
        src: "releaseReservation",
        input: ({ context }) => ({
          releaseFn: context.releaseFn,
          reservationId: context.reservationId!,
        }),
        onDone: {
          target: "released",
          actions: assign({ reservationId: () => null }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    released: {
      type: "final",
    },

    unavailable: {
      on: {
        RETRY: {
          target: "idle",
          actions: assign({ error: () => null }),
        },
      },
    },

    failed: {
      on: {
        RETRY: {
          target: "idle",
          actions: assign({ error: () => null }),
        },
      },
    },
  },
})

// ─── Helper: bind machine actors to an Effect service layer ──────────────────

export const makeReservationMachineInput = (
  layer: Layer.Layer<InventoryService>,
): ReservationMachineInput => {
  const run = <A, E>(effect: Effect.Effect<A, E, InventoryService>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, layer))

  return {
    checkFn: async (itemId, quantity) => {
      const info = await run(checkAvailability(itemId))
      if (info.availableQuantity < quantity) {
        throw new InsufficientStock({
          itemId,
          requested: quantity,
          available: info.availableQuantity,
        })
      }
      return info.availableQuantity
    },
    reserveFn: async (itemId, quantity) => {
      const reservation = await run(reserve(itemId, quantity))
      return reservation.id
    },
    releaseFn: async (reservationId) => {
      await run(release(reservationId))
    },
  }
}