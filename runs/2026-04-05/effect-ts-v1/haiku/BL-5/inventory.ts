import * as Effect from "effect";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { createMachine, assign } from "xstate";

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

export const InventoryItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  totalStock: Schema.Number,
});

export const ReservationSchema = Schema.Struct({
  id: Schema.String,
  itemId: Schema.String,
  quantity: Schema.Number,
  timestamp: Schema.Number,
});

export const InventoryStateSchema = Schema.Struct({
  items: Schema.Record(Schema.String, InventoryItemSchema),
  reservations: Schema.Record(Schema.String, ReservationSchema),
  reserved: Schema.Record(Schema.String, Schema.Number),
});

export type InventoryItem = Schema.Schema.Type<typeof InventoryItemSchema>;
export type Reservation = Schema.Schema.Type<typeof ReservationSchema>;
export type InventoryState = Schema.Schema.Type<typeof InventoryStateSchema>;

// ============================================================================
// ERRORS
// ============================================================================

export class InsufficientStockError extends Error {
  readonly _tag = "InsufficientStockError";
  constructor(
    readonly itemId: string,
    readonly requested: number,
    readonly available: number
  ) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
  }
}

export class ItemNotFoundError extends Error {
  readonly _tag = "ItemNotFoundError";
  constructor(readonly itemId: string) {
    super(`Item ${itemId} not found`);
  }
}

export class ReservationNotFoundError extends Error {
  readonly _tag = "ReservationNotFoundError";
  constructor(readonly reservationId: string) {
    super(`Reservation ${reservationId} not found`);
  }
}

export type InventoryError =
  | InsufficientStockError
  | ItemNotFoundError
  | ReservationNotFoundError;

// ============================================================================
// SERVICE
// ============================================================================

export interface InventoryService {
  readonly reserveStock: (
    itemId: string,
    quantity: number
  ) => Effect.Effect<
    Reservation,
    InsufficientStockError | ItemNotFoundError,
    never
  >;
  readonly releaseReservation: (
    reservationId: string
  ) => Effect.Effect<void, ReservationNotFoundError, never>;
  readonly checkAvailability: (
    itemId: string
  ) => Effect.Effect<number, ItemNotFoundError, never>;
}

// ============================================================================
// FACTORY
// ============================================================================

export const makeInventoryService = (
  initialState: InventoryState
): Effect.Effect<InventoryService, never, Semaphore.Semaphore> =>
  Effect.gen(function* () {
    const semaphore = yield* Semaphore.make(1);
    let state = initialState;

    const withLock = <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E, R | Semaphore.Semaphore> =>
      Effect.gen(function* () {
        return yield* Semaphore.withPermit(semaphore)(effect);
      });

    const reserveStock = (
      itemId: string,
      quantity: number
    ): Effect.Effect<
      Reservation,
      InsufficientStockError | ItemNotFoundError,
      Semaphore.Semaphore
    > =>
      withLock(
        Effect.gen(function* () {
          const item = state.items[itemId];
          if (!item) {
            yield* Effect.fail(new ItemNotFoundError(itemId));
          }

          const reserved = state.reserved[itemId] ?? 0;
          const available = item.totalStock - reserved;

          if (available < quantity) {
            yield* Effect.fail(
              new InsufficientStockError(itemId, quantity, available)
            );
          }

          const reservation: Reservation = {
            id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            itemId,
            quantity,
            timestamp: Date.now(),
          };

          state = {
            ...state,
            reservations: {
              ...state.reservations,
              [reservation.id]: reservation,
            },
            reserved: {
              ...state.reserved,
              [itemId]: reserved + quantity,
            },
          };

          return reservation;
        })
      );

    const releaseReservation = (
      reservationId: string
    ): Effect.Effect<
      void,
      ReservationNotFoundError,
      Semaphore.Semaphore
    > =>
      withLock(
        Effect.gen(function* () {
          const reservation = state.reservations[reservationId];
          if (!reservation) {
            yield* Effect.fail(new ReservationNotFoundError(reservationId));
          }

          const reserved = state.reserved[reservation.itemId] ?? 0;
          const newReserved = Math.max(0, reserved - reservation.quantity);

          const { [reservationId]: _, ...remainingReservations } =
            state.reservations;

          state = {
            ...state,
            reservations: remainingReservations,
            reserved: {
              ...state.reserved,
              [reservation.itemId]: newReserved,
            },
          };
        })
      );

    const checkAvailability = (
      itemId: string
    ): Effect.Effect<number, ItemNotFoundError, Semaphore.Semaphore> =>
      withLock(
        Effect.gen(function* () {
          const item = state.items[itemId];
          if (!item) {
            yield* Effect.fail(new ItemNotFoundError(itemId));
          }

          const reserved = state.reserved[itemId] ?? 0;
          return item.totalStock - reserved;
        })
      );

    return {
      reserveStock,
      releaseReservation,
      checkAvailability,
    } as InventoryService;
  });

// ============================================================================
// XSTATE MACHINE
// ============================================================================

export type InventoryEvent =
  | { type: "RESERVE"; itemId: string; quantity: number }
  | { type: "RELEASE"; reservationId: string }
  | { type: "CHECK"; itemId: string }
  | { type: "SUCCESS" }
  | { type: "FAILURE"; error: string }
  | { type: "RETRY" };

export interface InventoryMachineContext {
  error?: string;
  result?: unknown;
}

export const createInventoryMachine = () =>
  createMachine<InventoryMachineContext, InventoryEvent>({
    id: "inventory",
    initial: "idle",
    context: {
      error: undefined,
      result: undefined,
    },
    states: {
      idle: {
        on: {
          RESERVE: "reserving",
          RELEASE: "releasing",
          CHECK: "checking",
        },
      },
      reserving: {
        on: {
          SUCCESS: {
            target: "idle",
            actions: assign({
              error: undefined,
              result: (_, event) => event,
            }),
          },
          FAILURE: {
            target: "error",
            actions: assign({
              error: (_, event) => event.error,
            }),
          },
        },
      },
      releasing: {
        on: {
          SUCCESS: {
            target: "idle",
            actions: assign({
              error: undefined,
            }),
          },
          FAILURE: {
            target: "error",
            actions: assign({
              error: (_, event) => event.error,
            }),
          },
        },
      },
      checking: {
        on: {
          SUCCESS: {
            target: "idle",
            actions: assign({
              error: undefined,
              result: (_, event) => event,
            }),
          },
          FAILURE: {
            target: "error",
            actions: assign({
              error: (_, event) => event.error,
            }),
          },
        },
      },
      error: {
        on: {
          RETRY: {
            target: "idle",
            actions: assign({
              error: undefined,
            }),
          },
        },
      },
    },
  });

// ============================================================================
// LAYER
// ============================================================================

export const InventoryServiceLive = (
  initialState: InventoryState
): Effect.Layer.Layer<InventoryService, never, Semaphore.Semaphore> =>
  Effect.Layer.effect(InventoryService, makeInventoryService(initialState));

export const InventoryServiceTag = Effect.Tag<InventoryService>();