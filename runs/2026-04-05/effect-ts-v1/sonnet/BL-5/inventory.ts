/**
 * inventory.ts
 * BL-5 – Inventory Reservation System
 *
 * Constraints
 * ───────────
 * • Zero Unhandled Errors  – every leaf returns Effect<A, E, R>
 * • Deterministic State    – XState v5 machine owns the lifecycle
 * • Resilience First       – retryPolicy exported; apply it to any real I/O
 * • Schema Validation      – all external data decoded before use
 */

import {
  Context,
  Data,
  Effect,
  Either,
  HashMap,
  Layer,
  Option,
  Ref,
  Schedule,
  Schema,
} from "effect";
import { assign, createMachine } from "xstate";

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const InventoryItemSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  totalQuantity: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
  ),
  reservedQuantity: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
  ),
});

export const ReservationRequestSchema = Schema.Struct({
  itemId: Schema.NonEmptyString,
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
  ),
  reservedBy: Schema.NonEmptyString,
});

export const ReservationSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  itemId: Schema.NonEmptyString,
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
  ),
  reservedBy: Schema.NonEmptyString,
  reservedAt: Schema.DateFromSelf,
  status: Schema.Literal("active", "released"),
});

export const AvailabilityResultSchema = Schema.Struct({
  itemId: Schema.NonEmptyString,
  totalQuantity: Schema.Number,
  reservedQuantity: Schema.Number,
  availableQuantity: Schema.Number,
  isAvailable: Schema.Boolean,
});

export type InventoryItem = Schema.Schema.Type<typeof InventoryItemSchema>;
export type ReservationRequest = Schema.Schema.Type<
  typeof ReservationRequestSchema
>;
export type Reservation = Schema.Schema.Type<typeof ReservationSchema>;
export type AvailabilityResult = Schema.Schema.Type<
  typeof AvailabilityResultSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────────────────────

export class InsufficientStockError extends Data.TaggedError(
  "InsufficientStockError",
)<{
  readonly itemId: string;
  readonly requested: number;
  readonly available: number;
}> {}

export class ReservationNotFoundError extends Data.TaggedError(
  "ReservationNotFoundError",
)<{
  readonly reservationId: string;
}> {}

export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
  readonly itemId: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class AlreadyReleasedError extends Data.TaggedError(
  "AlreadyReleasedError",
)<{
  readonly reservationId: string;
}> {}

export type InventoryError =
  | InsufficientStockError
  | ReservationNotFoundError
  | ItemNotFoundError
  | ValidationError
  | AlreadyReleasedError;

// ─────────────────────────────────────────────────────────────────────────────
// XSTATE MACHINE  (models the lifecycle of a single reservation operation)
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryMachineContext {
  reservationId: string | undefined;
  itemId: string | undefined;
  requestedQuantity: number;
  availableQuantity: number;
  errorMessage: string | undefined;
}

export type InventoryMachineEvent =
  | { type: "RESERVE"; itemId: string; quantity: number; reservedBy: string }
  | { type: "RELEASE"; reservationId: string }
  | { type: "CHECK"; itemId: string; quantity?: number }
  | { type: "AVAILABLE"; availableQuantity: number }
  | { type: "UNAVAILABLE"; reason: string }
  | { type: "RESERVE_SUCCESS"; reservationId: string }
  | { type: "RESERVE_FAILURE"; reason: string }
  | { type: "RELEASE_SUCCESS" }
  | { type: "RELEASE_FAILURE"; reason: string }
  | { type: "CHECK_COMPLETE"; availableQuantity: number }
  | { type: "RESET" };

export const inventoryMachine = createMachine({
  id: "inventoryReservation",
  initial: "idle",
  types: {} as {
    context: InventoryMachineContext;
    events: InventoryMachineEvent;
  },
  context: {
    reservationId: undefined,
    itemId: undefined,
    requestedQuantity: 0,
    availableQuantity: 0,
    errorMessage: undefined,
  },
  states: {
    idle: {
      on: {
        RESERVE: {
          target: "checkingAvailability",
          actions: assign({
            itemId: ({ event }) => event.itemId,
            requestedQuantity: ({ event }) => event.quantity,
            reservationId: () => undefined as string | undefined,
            errorMessage: () => undefined as string | undefined,
          }),
        },
        RELEASE: {
          target: "releasing",
          actions: assign({
            reservationId: ({ event }) => event.reservationId,
            errorMessage: () => undefined as string | undefined,
          }),
        },
        CHECK: {
          target: "checkingAvailability",
          actions: assign({
            itemId: ({ event }) => event.itemId,
            errorMessage: () => undefined as string | undefined,
          }),
        },
      },
    },

    checkingAvailability: {
      on: {
        AVAILABLE: {
          target: "reserving",
          actions: assign({
            availableQuantity: ({ event }) => event.availableQuantity,
          }),
        },
        UNAVAILABLE: {
          target: "failed",
          actions: assign({
            errorMessage: ({ event }) => event.reason,
          }),
        },
        CHECK_COMPLETE: {
          target: "idle",
          actions: assign({
            availableQuantity: ({ event }) => event.availableQuantity,
          }),
        },
      },
    },

    reserving: {
      on: {
        RESERVE_SUCCESS: {
          target: "reserved",
          actions: assign({
            reservationId: ({ event }) => event.reservationId,
          }),
        },
        RESERVE_FAILURE: {
          target: "failed",
          actions: assign({
            errorMessage: ({ event }) => event.reason,
          }),
        },
      },
    },

    reserved: {
      on: {
        RELEASE: {
          target: "releasing",
          actions: assign({
            reservationId: ({ event }) => event.reservationId,
            errorMessage: () => undefined as string | undefined,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            reservationId: () => undefined as string | undefined,
            errorMessage: () => undefined as string | undefined,
          }),
        },
      },
    },

    releasing: {
      on: {
        RELEASE_SUCCESS: { target: "released" },
        RELEASE_FAILURE: {
          target: "failed",
          actions: assign({
            errorMessage: ({ event }) => event.reason,
          }),
        },
      },
    },

    released: {
      on: {
        RESET: {
          target: "idle",
          actions: assign({
            reservationId: () => undefined as string | undefined,
            errorMessage: () => undefined as string | undefined,
          }),
        },
      },
    },

    failed: {
      on: {
        RESET: {
          target: "idle",
          actions: assign({
            errorMessage: () => undefined as string | undefined,
          }),
        },
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// RETRY POLICY  (apply to any real I/O — e.g. database, HTTP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponential back-off starting at 50 ms, doubling each attempt,
 * with a maximum of 3 retries (4 total attempts).
 */
export const retryPolicy: Schedule.Schedule<
  readonly [number, number],
  unknown,
  never
> = Schedule.exponential("50 millis", 2).pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE INTERFACE & CONTEXT TAG
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryServiceShape {
  readonly addItem: (
    raw: unknown,
  ) => Effect.Effect<InventoryItem, ValidationError>;

  readonly reserveStock: (
    raw: unknown,
  ) => Effect.Effect<
    Reservation,
    InsufficientStockError | ItemNotFoundError | ValidationError
  >;

  readonly releaseStock: (
    reservationId: string,
  ) => Effect.Effect<
    Reservation,
    ReservationNotFoundError | AlreadyReleasedError
  >;

  readonly checkAvailability: (
    itemId: string,
    quantity?: number,
  ) => Effect.Effect<AvailabilityResult, ItemNotFoundError>;

  readonly getReservation: (
    reservationId: string,
  ) => Effect.Effect<Reservation, ReservationNotFoundError>;
}

export class InventoryService extends Context.Tag("InventoryService")<
  InventoryService,
  InventoryServiceShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const makeInventoryService: Effect.Effect<InventoryServiceShape> = Effect.gen(
  function* () {
    // In-memory stores – Ref guarantees atomic, concurrent-safe reads/writes.
    const itemsRef = yield* Ref.make(HashMap.empty<string, InventoryItem>());
    const reservationsRef = yield* Ref.make(
      HashMap.empty<string, Reservation>(),
    );

    // ── decoders ───────────────────────────────────────────────────────────

    const decodeItem = Schema.decodeUnknown(InventoryItemSchema);
    const decodeRequest = Schema.decodeUnknown(ReservationRequestSchema);

    // ── addItem ────────────────────────────────────────────────────────────

    const addItem = (raw: unknown): Effect.Effect<InventoryItem, ValidationError> =>
      decodeItem(raw).pipe(
        Effect.mapError(
          (e) =>
            new ValidationError({
              message: "Invalid inventory item data",
              cause: e,
            }),
        ),
        Effect.flatMap((item) =>
          Ref.update(itemsRef, HashMap.set(item.id, item)).pipe(
            Effect.as(item),
          ),
        ),
      );

    // ── reserveStock ───────────────────────────────────────────────────────

    const reserveStock = (
      raw: unknown,
    ): Effect.Effect<
      Reservation,
      InsufficientStockError | ItemNotFoundError | ValidationError
    > =>
      Effect.gen(function* () {
        const request = yield* decodeRequest(raw).pipe(
          Effect.mapError(
            (e) =>
              new ValidationError({
                message: "Invalid reservation request",
                cause: e,
              }),
          ),
        );

        /*
         * Ref.modify is atomic: the read-check-write triple cannot be
         * interleaved by another fiber, giving us concurrent-style safety
         * without locks.
         */
        const outcome = yield* Ref.modify(itemsRef, (items) => {
          const maybeItem = HashMap.get(items, request.itemId);

          if (Option.isNone(maybeItem)) {
            return [
              Either.left(
                new ItemNotFoundError({ itemId: request.itemId }),
              ) as Either.Either<
                ItemNotFoundError | InsufficientStockError,
                undefined
              >,
              items,
            ] as const;
          }

          const item = maybeItem.value;
          const available = item.totalQuantity - item.reservedQuantity;

          if (available < request.quantity) {
            return [
              Either.left(
                new InsufficientStockError({
                  itemId: request.itemId,
                  requested: request.quantity,
                  available,
                }),
              ) as Either.Either<
                ItemNotFoundError | InsufficientStockError,
                undefined
              >,
              items,
            ] as const;
          }

          const updated: InventoryItem = {
            ...item,
            reservedQuantity: item.reservedQuantity + request.quantity,
          };

          return [
            Either.right(undefined) as Either.Either<
              ItemNotFoundError | InsufficientStockError,
              undefined
            >,
            HashMap.set(items, request.itemId, updated),
          ] as const;
        });

        // Propagate error from atomic check; succeeds with undefined on happy path.
        yield* Effect.fromEither(outcome);

        const reservation: Reservation = {
          id: crypto.randomUUID(),
          itemId: request.itemId,
          quantity: request.quantity,
          reservedBy: request.reservedBy,
          reservedAt: new Date(),
          status: "active",
        };

        yield* Ref.update(
          reservationsRef,
          HashMap.set(reservation.id, reservation),
        );

        return reservation;
      });

    // ── releaseStock ───────────────────────────────────────────────────────

    const releaseStock = (
      reservationId: string,
    ): Effect.Effect<
      Reservation,
      ReservationNotFoundError | AlreadyReleasedError
    > =>
      Effect.gen(function* () {
        /*
         * Atomically mark the reservation as released so two concurrent
         * callers cannot double-release the same reservation.
         */
        const outcome = yield* Ref.modify(reservationsRef, (reservations) => {
          const maybeReservation = HashMap.get(reservations, reservationId);

          if (Option.isNone(maybeReservation)) {
            return [
              Either.left(
                new ReservationNotFoundError({ reservationId }),
              ) as Either.Either<
                ReservationNotFoundError | AlreadyReleasedError,
                Reservation
              >,
              reservations,
            ] as const;
          }

          const reservation = maybeReservation.value;

          if (reservation.status === "released") {
            return [
              Either.left(
                new AlreadyReleasedError({ reservationId }),
              ) as Either.Either<
                ReservationNotFoundError | AlreadyReleasedError,
                Reservation
              >,
              reservations,
            ] as const;
          }

          const updated: Reservation = { ...reservation, status: "released" };

          return [
            Either.right(updated) as Either.Either<
              ReservationNotFoundError | AlreadyReleasedError,
              Reservation
            >,
            HashMap.set(reservations, reservationId, updated),
          ] as const;
        });

        const reservation = yield* Effect.fromEither(outcome);

        // Return the stock to the item – also atomic.
        yield* Ref.update(itemsRef, (items) => {
          const maybeItem = HashMap.get(items, reservation.itemId);
          if (Option.isNone(maybeItem)) return items;
          const item = maybeItem.value;
          return HashMap.set(items, reservation.itemId, {
            ...item,
            reservedQuantity: Math.max(
              0,
              item.reservedQuantity - reservation.quantity,
            ),
          });
        });

        return reservation;
      });

    // ── checkAvailability ──────────────────────────────────────────────────

    const checkAvailability = (
      itemId: string,
      quantity?: number,
    ): Effect.Effect<AvailabilityResult, ItemNotFoundError> =>
      Effect.gen(function* () {
        const items = yield* Ref.get(itemsRef);
        const maybeItem = HashMap.get(items, itemId);

        if (Option.isNone(maybeItem)) {
          return yield* Effect.fail(new ItemNotFoundError({ itemId }));
        }

        const { totalQuantity, reservedQuantity } = maybeItem.value;
        const availableQuantity = totalQuantity - reservedQuantity;
        const isAvailable =
          quantity !== undefined
            ? availableQuantity >= quantity
            : availableQuantity > 0;

        return {
          itemId,
          totalQuantity,
          reservedQuantity,
          availableQuantity,
          isAvailable,
        };
      });

    // ── getReservation ─────────────────────────────────────────────────────

    const getReservation = (
      reservationId: string,
    ): Effect.Effect<Reservation, ReservationNotFoundError> =>
      Effect.gen(function* () {
        const reservations = yield* Ref.get(reservationsRef);
        const maybeReservation = HashMap.get(reservations, reservationId);

        if (Option.isNone(maybeReservation)) {
          return yield* Effect.fail(
            new ReservationNotFoundError({ reservationId }),
          );
        }

        return maybeReservation.value;
      });

    // ── assemble ───────────────────────────────────────────────────────────

    return {
      addItem,
      reserveStock,
      releaseStock,
      checkAvailability,
      getReservation,
    } satisfies InventoryServiceShape;
  },
);

export const InventoryServiceLive: Layer.Layer<InventoryService> =
  Layer.effect(InventoryService, makeInventoryService);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC CONVENIENCE FUNCTIONS  (require InventoryService from context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and add a new item to the inventory store.
 */
export const addInventoryItem = (
  raw: unknown,
): Effect.Effect<InventoryItem, ValidationError, InventoryService> =>
  Effect.flatMap(InventoryService, (svc) => svc.addItem(raw));

/**
 * Atomically reserve `quantity` units of an item.
 *
 * For a real persistence layer, wrap with:
 *   Effect.retry(reserveStock(req), retryPolicy)
 */
export const reserveStock = (
  raw: unknown,
): Effect.Effect<
  Reservation,
  InsufficientStockError | ItemNotFoundError | ValidationError,
  InventoryService
> => Effect.flatMap(InventoryService, (svc) => svc.reserveStock(raw));

/**
 * Atomically release a previously active reservation.
 *
 * For a real persistence layer, wrap with:
 *   Effect.retry(releaseStock(id), retryPolicy)
 */
export const releaseStock = (
  reservationId: string,
): Effect.Effect<
  Reservation,
  ReservationNotFoundError | AlreadyReleasedError,
  InventoryService
> =>
  Effect.flatMap(InventoryService, (svc) => svc.releaseStock(reservationId));

/**
 * Check availability for an item, optionally against a required quantity.
 */
export const checkAvailability = (
  itemId: string,
  quantity?: number,
): Effect.Effect<AvailabilityResult, ItemNotFoundError, InventoryService> =>
  Effect.flatMap(InventoryService, (svc) =>
    svc.checkAvailability(itemId, quantity),
  );

/**
 * Retrieve a single reservation by ID.
 */
export const getReservation = (
  reservationId: string,
): Effect.Effect<Reservation, ReservationNotFoundError, InventoryService> =>
  Effect.flatMap(InventoryService, (svc) => svc.getReservation(reservationId));