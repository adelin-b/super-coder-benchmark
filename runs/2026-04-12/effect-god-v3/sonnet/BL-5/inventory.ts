import { Effect, Data, Exit, Cause } from "effect";
import crypto from "crypto";

// ─── Internal Tagged Errors ────────────────────────────────────────────────────

class InternalInsufficientStock extends Data.TaggedError("InternalInsufficientStock")<{
  itemId: string;
  requested: number;
  available: number;
}> {}

class InternalReservationNotFound extends Data.TaggedError("InternalReservationNotFound")<{
  reservationId: string;
}> {}

class InternalItemNotFound extends Data.TaggedError("InternalItemNotFound")<{
  itemId: string;
}> {}

class InternalInvalidOperation extends Data.TaggedError("InternalInvalidOperation")<{
  reason: string;
}> {}

// ─── Public Error Classes ─────────────────────────────────────────────────────

export class InsufficientStockError extends Error {
  readonly itemId: string;
  readonly requested: number;
  readonly available: number;

  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item "${itemId}": requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
    this.itemId = itemId;
    this.requested = requested;
    this.available = available;
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

export class ReservationNotFoundError extends Error {
  readonly reservationId: string;

  constructor(reservationId: string) {
    super(`Reservation not found: "${reservationId}"`);
    this.name = "ReservationNotFoundError";
    this.reservationId = reservationId;
    Object.setPrototypeOf(this, ReservationNotFoundError.prototype);
  }
}

export class ItemNotFoundError extends Error {
  readonly itemId: string;

  constructor(itemId: string) {
    super(`Item not found: "${itemId}"`);
    this.name = "ItemNotFoundError";
    this.itemId = itemId;
    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

export class InvalidOperationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidOperationError";
    Object.setPrototypeOf(this, InvalidOperationError.prototype);
  }
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  quantity: number;
}

export type ReservationStatus = "pending" | "confirmed" | "released";

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  status: ReservationStatus;
}

export interface Inventory {
  reserve(itemId: string, quantity: number): string;
  release(reservationId: string): void;
  confirm(reservationId: string): void;
  getAvailable(itemId: string): number;
  getReservation(reservationId: string): Reservation;
  getTotalStock(itemId: string): number;
  listReservations(itemId?: string): Reservation[];
}

// ─── Internal State ───────────────────────────────────────────────────────────

interface ItemState {
  id: string;
  totalStock: number; // decremented on confirm
  pendingReservations: Map<string, number>; // reservationId -> quantity
}

// ─── Effect Helpers ───────────────────────────────────────────────────────────

type InternalError =
  | InternalInsufficientStock
  | InternalReservationNotFound
  | InternalItemNotFound
  | InternalInvalidOperation;

function getItemState(
  itemStates: Map<string, ItemState>,
  itemId: string
): Effect.Effect<ItemState, InternalItemNotFound> {
  return Effect.gen(function* () {
    const state = itemStates.get(itemId);
    if (!state) yield* Effect.fail(new InternalItemNotFound({ itemId }));
    return state!;
  });
}

function computeAvailable(state: ItemState): number {
  const pendingTotal = Array.from(state.pendingReservations.values()).reduce(
    (sum, q) => sum + q,
    0
  );
  return state.totalStock - pendingTotal;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createInventory(items: InventoryItem[]): Inventory {
  // Validate initialization
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Inventory must be initialized with at least one item");
  }

  for (const item of items) {
    if (item.quantity < 0) {
      throw new Error(
        `Item quantity cannot be negative for item "${item.id}"`
      );
    }
  }

  // Mutable internal state
  const itemStates = new Map<string, ItemState>();
  const reservations = new Map<string, Reservation>();

  for (const item of items) {
    itemStates.set(item.id, {
      id: item.id,
      totalStock: item.quantity,
      pendingReservations: new Map(),
    });
  }

  // ── Internal Effects ──────────────────────────────────────────────────────

  const getAvailableEffect = (
    itemId: string
  ): Effect.Effect<number, InternalItemNotFound> =>
    Effect.gen(function* () {
      const state = yield* getItemState(itemStates, itemId);
      return computeAvailable(state);
    });

  const reserveEffect = (
    itemId: string,
    quantity: number
  ): Effect.Effect<string, InternalItemNotFound | InternalInsufficientStock> =>
    Effect.gen(function* () {
      const state = yield* getItemState(itemStates, itemId);
      const available = computeAvailable(state);

      if (available < quantity) {
        yield* Effect.fail(
          new InternalInsufficientStock({ itemId, requested: quantity, available })
        );
      }

      const reservationId = crypto.randomUUID();
      state.pendingReservations.set(reservationId, quantity);

      const reservation: Reservation = {
        id: reservationId,
        itemId,
        quantity,
        status: "pending",
      };
      reservations.set(reservationId, reservation);

      return reservationId;
    });

  const releaseEffect = (
    reservationId: string
  ): Effect.Effect<void, InternalReservationNotFound | InternalInvalidOperation> =>
    Effect.gen(function* () {
      const reservation = reservations.get(reservationId);
      if (!reservation) {
        yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
      }
      if (reservation!.status !== "pending") {
        yield* Effect.fail(
          new InternalInvalidOperation({
            reason: `Cannot release reservation "${reservationId}" with status "${reservation!.status}"`,
          })
        );
      }

      const state = itemStates.get(reservation!.itemId)!;
      state.pendingReservations.delete(reservationId);
      reservation!.status = "released";
    });

  const confirmEffect = (
    reservationId: string
  ): Effect.Effect<void, InternalReservationNotFound | InternalInvalidOperation> =>
    Effect.gen(function* () {
      const reservation = reservations.get(reservationId);
      if (!reservation) {
        yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
      }
      if (reservation!.status !== "pending") {
        yield* Effect.fail(
          new InternalInvalidOperation({
            reason: `Cannot confirm reservation "${reservationId}" with status "${reservation!.status}"`,
          })
        );
      }

      const state = itemStates.get(reservation!.itemId)!;
      // Remove from pending and permanently deduct from total stock
      state.pendingReservations.delete(reservationId);
      state.totalStock -= reservation!.quantity;
      reservation!.status = "confirmed";
    });

  // ── Boundary Helpers ──────────────────────────────────────────────────────

  function runOrThrow<A>(effect: Effect.Effect<A, InternalError>): A {
    const exit = Effect.runSyncExit(effect);
    if (Exit.isSuccess(exit)) return exit.value;

    const raw = Cause.squash(exit.cause);
    const tag = (raw as any)._tag as string | undefined;

    if (tag === "InternalInsufficientStock") {
      const e = raw as InternalInsufficientStock;
      throw new InsufficientStockError(e.itemId, e.requested, e.available);
    }
    if (tag === "InternalItemNotFound") {
      const e = raw as InternalItemNotFound;
      throw new ItemNotFoundError(e.itemId);
    }
    if (tag === "InternalReservationNotFound") {
      const e = raw as InternalReservationNotFound;
      throw new ReservationNotFoundError(e.reservationId);
    }
    if (tag === "InternalInvalidOperation") {
      const e = raw as InternalInvalidOperation;
      throw new InvalidOperationError(e.reason);
    }

    throw new Error(raw instanceof Error ? raw.message : String(raw));
  }

  // ── Public Interface ──────────────────────────────────────────────────────

  return {
    reserve(itemId: string, quantity: number): string {
      if (typeof quantity !== "number" || quantity <= 0) {
        throw new Error("Quantity must be a positive number");
      }
      return runOrThrow(reserveEffect(itemId, quantity));
    },

    release(reservationId: string): void {
      if (!reservationId) throw new ReservationNotFoundError(reservationId);
      runOrThrow(releaseEffect(reservationId));
    },

    confirm(reservationId: string): void {
      if (!reservationId) throw new ReservationNotFoundError(reservationId);
      runOrThrow(confirmEffect(reservationId));
    },

    getAvailable(itemId: string): number {
      return runOrThrow(getAvailableEffect(itemId));
    },

    getReservation(reservationId: string): Reservation {
      const reservation = reservations.get(reservationId);
      if (!reservation) throw new ReservationNotFoundError(reservationId);
      return { ...reservation };
    },

    getTotalStock(itemId: string): number {
      const state = itemStates.get(itemId);
      if (!state) throw new ItemNotFoundError(itemId);
      return state.totalStock;
    },

    listReservations(itemId?: string): Reservation[] {
      const all = Array.from(reservations.values()).map((r) => ({ ...r }));
      if (itemId !== undefined) {
        return all.filter((r) => r.itemId === itemId);
      }
      return all;
    },
  };
}