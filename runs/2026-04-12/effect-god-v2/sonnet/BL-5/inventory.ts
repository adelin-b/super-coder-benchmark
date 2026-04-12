import { Effect, Data, Exit, Cause } from "effect";
import * as crypto from "crypto";

// ─── Typed Domain Errors ────────────────────────────────────────────────────

class InternalInsufficientStock extends Data.TaggedError("InternalInsufficientStock")<{
  sku: string;
  requested: number;
  available: number;
}> {}

class InternalItemNotFound extends Data.TaggedError("InternalItemNotFound")<{
  sku: string;
}> {}

class InternalReservationNotFound extends Data.TaggedError("InternalReservationNotFound")<{
  reservationId: string;
}> {}

// ─── Public Error Classes ────────────────────────────────────────────────────

export class InsufficientStockError extends Error {
  readonly sku: string;
  readonly requested: number;
  readonly available: number;
  constructor(sku: string, requested: number, available: number) {
    super(`Insufficient stock for SKU "${sku}": requested ${requested}, available ${available}`);
    this.name = "InsufficientStockError";
    this.sku = sku;
    this.requested = requested;
    this.available = available;
  }
}

export class ItemNotFoundError extends Error {
  readonly sku: string;
  constructor(sku: string) {
    super(`Item not found: "${sku}"`);
    this.name = "ItemNotFoundError";
    this.sku = sku;
  }
}

export class ReservationNotFoundError extends Error {
  readonly reservationId: string;
  constructor(reservationId: string) {
    super(`Reservation not found: "${reservationId}"`);
    this.name = "ReservationNotFoundError";
    this.reservationId = reservationId;
  }
}

// ─── Internal State ──────────────────────────────────────────────────────────

interface InventoryItem {
  sku: string;
  totalStock: number;       // original stock minus confirmed reservations
  reservedQuantity: number; // sum of pending reservations
}

interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  status: "pending" | "confirmed" | "released";
  createdAt: Date;
}

interface InventoryState {
  items: Map<string, InventoryItem>;
  reservations: Map<string, Reservation>;
}

// ─── Internal Effect Logic ───────────────────────────────────────────────────

type DomainError = InternalInsufficientStock | InternalItemNotFound | InternalReservationNotFound;

const getItem = (
  state: InventoryState,
  sku: string
): Effect.Effect<InventoryItem, InternalItemNotFound> =>
  Effect.gen(function* () {
    const item = state.items.get(sku);
    if (!item) yield* Effect.fail(new InternalItemNotFound({ sku }));
    return item!;
  });

const reserveEffect = (
  state: InventoryState,
  sku: string,
  quantity: number
): Effect.Effect<string, InternalInsufficientStock | InternalItemNotFound> =>
  Effect.gen(function* () {
    const item = yield* getItem(state, sku);
    const available = item.totalStock - item.reservedQuantity;
    if (available < quantity) {
      yield* Effect.fail(new InternalInsufficientStock({ sku, requested: quantity, available }));
    }
    const id = crypto.randomUUID();
    const reservation: Reservation = {
      id,
      sku,
      quantity,
      status: "pending",
      createdAt: new Date(),
    };
    state.reservations.set(id, reservation);
    item.reservedQuantity += quantity;
    return id;
  });

const releaseEffect = (
  state: InventoryState,
  reservationId: string
): Effect.Effect<void, InternalReservationNotFound | InternalItemNotFound> =>
  Effect.gen(function* () {
    const reservation = state.reservations.get(reservationId);
    if (!reservation || reservation.status !== "pending") {
      yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
    }
    const res = reservation!;
    const item = yield* getItem(state, res.sku);
    res.status = "released";
    item.reservedQuantity -= res.quantity;
  });

const confirmEffect = (
  state: InventoryState,
  reservationId: string
): Effect.Effect<void, InternalReservationNotFound | InternalItemNotFound> =>
  Effect.gen(function* () {
    const reservation = state.reservations.get(reservationId);
    if (!reservation || reservation.status !== "pending") {
      yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
    }
    const res = reservation!;
    const item = yield* getItem(state, res.sku);
    res.status = "confirmed";
    item.reservedQuantity -= res.quantity;
    item.totalStock -= res.quantity;
  });

const getAvailableEffect = (
  state: InventoryState,
  sku: string
): Effect.Effect<number, InternalItemNotFound> =>
  Effect.gen(function* () {
    const item = yield* getItem(state, sku);
    return item.totalStock - item.reservedQuantity;
  });

const getReservedEffect = (
  state: InventoryState,
  sku: string
): Effect.Effect<number, InternalItemNotFound> =>
  Effect.gen(function* () {
    const item = yield* getItem(state, sku);
    return item.reservedQuantity;
  });

const getStockEffect = (
  state: InventoryState,
  sku: string
): Effect.Effect<number, InternalItemNotFound> =>
  Effect.gen(function* () {
    const item = yield* getItem(state, sku);
    return item.totalStock;
  });

// ─── Boundary Helper ─────────────────────────────────────────────────────────

function runOrThrow<A>(effect: Effect.Effect<A, DomainError>): A {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof InternalInsufficientStock) {
      throw new InsufficientStockError(err.sku, err.requested, err.available);
    }
    if (err instanceof InternalItemNotFound) {
      throw new ItemNotFoundError(err.sku);
    }
    if (err instanceof InternalReservationNotFound) {
      throw new ReservationNotFoundError(err.reservationId);
    }
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
  return exit.value;
}

// ─── Public Interface ─────────────────────────────────────────────────────────

export interface InventoryReservationSystem {
  /** Reserve `quantity` units of `sku`. Returns a reservation ID. */
  reserve(sku: string, quantity: number): string;
  /** Release a pending reservation, returning its stock to available. */
  release(reservationId: string): void;
  /** Confirm a pending reservation, permanently deducting stock. */
  confirm(reservationId: string): void;
  /** Available quantity = totalStock − pendingReservations. */
  getAvailable(sku: string): number;
  /** Total quantity currently held in pending reservations for this SKU. */
  getReserved(sku: string): number;
  /** Total remaining stock (after confirmed deductions) for this SKU. */
  getStock(sku: string): number;
  /** Add a new SKU or increase stock of an existing one. */
  addStock(sku: string, quantity: number): void;
  /** List all pending reservation IDs. */
  listReservations(): string[];
  /** Snapshot: returns a copy of current state per SKU. */
  snapshot(): Array<{ sku: string; totalStock: number; reserved: number; available: number }>;
}

export interface InventoryItemSpec {
  sku: string;
  quantity: number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createInventory(items: InventoryItemSpec[]): InventoryReservationSystem {
  if (!items || items.length === 0) {
    throw new Error("Inventory must be initialized with at least one item");
  }

  const state: InventoryState = {
    items: new Map(),
    reservations: new Map(),
  };

  for (const { sku, quantity } of items) {
    if (!sku || sku.trim() === "") throw new Error("SKU must be a non-empty string");
    if (quantity < 0) throw new Error(`Initial quantity for SKU "${sku}" cannot be negative`);
    if (state.items.has(sku)) {
      state.items.get(sku)!.totalStock += quantity;
    } else {
      state.items.set(sku, { sku, totalStock: quantity, reservedQuantity: 0 });
    }
  }

  return {
    reserve(sku: string, quantity: number): string {
      if (quantity <= 0) throw new Error(`Reserve quantity must be positive, got ${quantity}`);
      return runOrThrow(reserveEffect(state, sku, quantity));
    },

    release(reservationId: string): void {
      if (!reservationId) throw new ReservationNotFoundError(reservationId);
      return runOrThrow(releaseEffect(state, reservationId));
    },

    confirm(reservationId: string): void {
      if (!reservationId) throw new ReservationNotFoundError(reservationId);
      return runOrThrow(confirmEffect(state, reservationId));
    },

    getAvailable(sku: string): number {
      return runOrThrow(getAvailableEffect(state, sku));
    },

    getReserved(sku: string): number {
      return runOrThrow(getReservedEffect(state, sku));
    },

    getStock(sku: string): number {
      return runOrThrow(getStockEffect(state, sku));
    },

    addStock(sku: string, quantity: number): void {
      if (quantity < 0) throw new Error(`Added stock quantity cannot be negative`);
      if (state.items.has(sku)) {
        state.items.get(sku)!.totalStock += quantity;
      } else {
        if (!sku || sku.trim() === "") throw new Error("SKU must be a non-empty string");
        state.items.set(sku, { sku, totalStock: quantity, reservedQuantity: 0 });
      }
    },

    listReservations(): string[] {
      return Array.from(state.reservations.values())
        .filter((r) => r.status === "pending")
        .map((r) => r.id);
    },

    snapshot(): Array<{ sku: string; totalStock: number; reserved: number; available: number }> {
      return Array.from(state.items.values()).map((item) => ({
        sku: item.sku,
        totalStock: item.totalStock,
        reserved: item.reservedQuantity,
        available: item.totalStock - item.reservedQuantity,
      }));
    },
  };
}