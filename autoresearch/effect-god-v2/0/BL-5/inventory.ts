import { Effect, Data, Exit, Cause } from "effect";
import crypto from "crypto";

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class InsufficientStockError extends Error {
  constructor(public readonly itemId: string, public readonly requested: number, public readonly available: number) {
    super(`Insufficient stock for item "${itemId}": requested ${requested}, available ${available}`);
    this.name = "InsufficientStockError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(public readonly itemId: string) {
    super(`Item not found: "${itemId}"`);
    this.name = "ItemNotFoundError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation not found: "${reservationId}"`);
    this.name = "ReservationNotFoundError";
  }
}

// ─── Internal Tagged Errors ────────────────────────────────────────────────────

class InternalInsufficientStock extends Data.TaggedError("InternalInsufficientStock")<{
  itemId: string;
  requested: number;
  available: number;
}> {}

class InternalItemNotFound extends Data.TaggedError("InternalItemNotFound")<{
  itemId: string;
}> {}

class InternalReservationNotFound extends Data.TaggedError("InternalReservationNotFound")<{
  reservationId: string;
}> {}

// ─── Internal State ────────────────────────────────────────────────────────────

interface StockEntry {
  totalStock: number;
}

interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
}

// ─── Public Types ──────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  stock: number;
}

export interface ReserveResult {
  reservationId: string;
}

export interface InventorySystem {
  reserve(itemId: string, quantity: number): ReserveResult;
  release(reservationId: string): void;
  confirm(reservationId: string): void;
  getAvailable(itemId: string): number;
  addStock(itemId: string, quantity: number): void;
  getReservations(itemId: string): Array<{ id: string; quantity: number }>;
  getTotalStock(itemId: string): number;
}

// ─── Internal Effect Logic ─────────────────────────────────────────────────────

function makeEffects(
  stockMap: Map<string, StockEntry>,
  reservations: Map<string, Reservation>
) {
  const reserveEffect = (
    itemId: string,
    quantity: number
  ): Effect.Effect<string, InternalInsufficientStock | InternalItemNotFound> =>
    Effect.gen(function* () {
      const entry = stockMap.get(itemId);
      if (!entry) {
        yield* Effect.fail(new InternalItemNotFound({ itemId }));
      }

      const reserved = computeReservedQuantity(itemId, reservations);
      const available = entry!.totalStock - reserved;

      if (quantity > available) {
        yield* Effect.fail(
          new InternalInsufficientStock({ itemId, requested: quantity, available })
        );
      }

      const reservationId = crypto.randomUUID();
      reservations.set(reservationId, { id: reservationId, itemId, quantity });
      return reservationId;
    });

  const releaseEffect = (
    reservationId: string
  ): Effect.Effect<void, InternalReservationNotFound> =>
    Effect.gen(function* () {
      if (!reservations.has(reservationId)) {
        yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
      }
      reservations.delete(reservationId);
    });

  const confirmEffect = (
    reservationId: string
  ): Effect.Effect<void, InternalReservationNotFound | InternalItemNotFound> =>
    Effect.gen(function* () {
      const reservation = reservations.get(reservationId);
      if (!reservation) {
        yield* Effect.fail(new InternalReservationNotFound({ reservationId }));
      }

      const entry = stockMap.get(reservation!.itemId);
      if (!entry) {
        yield* Effect.fail(new InternalItemNotFound({ itemId: reservation!.itemId }));
      }

      // Permanently deduct from total stock, then remove reservation
      entry!.totalStock = Math.max(0, entry!.totalStock - reservation!.quantity);
      reservations.delete(reservationId);
    });

  const getAvailableEffect = (
    itemId: string
  ): Effect.Effect<number, InternalItemNotFound> =>
    Effect.gen(function* () {
      const entry = stockMap.get(itemId);
      if (!entry) {
        yield* Effect.fail(new InternalItemNotFound({ itemId }));
      }
      const reserved = computeReservedQuantity(itemId, reservations);
      return Math.max(0, entry!.totalStock - reserved);
    });

  const addStockEffect = (
    itemId: string,
    quantity: number
  ): Effect.Effect<void, InternalItemNotFound> =>
    Effect.gen(function* () {
      const entry = stockMap.get(itemId);
      if (!entry) {
        yield* Effect.fail(new InternalItemNotFound({ itemId }));
      }
      entry!.totalStock += quantity;
    });

  const getTotalStockEffect = (
    itemId: string
  ): Effect.Effect<number, InternalItemNotFound> =>
    Effect.gen(function* () {
      const entry = stockMap.get(itemId);
      if (!entry) {
        yield* Effect.fail(new InternalItemNotFound({ itemId }));
      }
      return entry!.totalStock;
    });

  return {
    reserveEffect,
    releaseEffect,
    confirmEffect,
    getAvailableEffect,
    addStockEffect,
    getTotalStockEffect,
  };
}

function computeReservedQuantity(
  itemId: string,
  reservations: Map<string, Reservation>
): number {
  let total = 0;
  for (const r of reservations.values()) {
    if (r.itemId === itemId) total += r.quantity;
  }
  return total;
}

// ─── Boundary: unwrap Effect → plain TS ───────────────────────────────────────

function runOrThrow<A>(
  eff: Effect.Effect<A, InternalInsufficientStock | InternalItemNotFound | InternalReservationNotFound>
): A {
  const exit = Effect.runSyncExit(eff);
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof InternalInsufficientStock) {
      throw new InsufficientStockError(err.itemId, err.requested, err.available);
    }
    if (err instanceof InternalItemNotFound) {
      throw new ItemNotFoundError(err.itemId);
    }
    if (err instanceof InternalReservationNotFound) {
      throw new ReservationNotFoundError(err.reservationId);
    }
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
  return exit.value;
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createInventory(items: InventoryItem[]): InventorySystem {
  if (!items || items.length === 0) {
    throw new Error("Inventory must be initialized with at least one item");
  }

  const stockMap = new Map<string, StockEntry>();
  for (const item of items) {
    if (item.stock < 0) {
      throw new Error(`Initial stock for item "${item.id}" cannot be negative`);
    }
    stockMap.set(item.id, { totalStock: item.stock });
  }

  const reservations = new Map<string, Reservation>();
  const effects = makeEffects(stockMap, reservations);

  return {
    reserve(itemId: string, quantity: number): ReserveResult {
      if (quantity <= 0) {
        throw new Error("Reservation quantity must be positive");
      }
      const reservationId = runOrThrow(effects.reserveEffect(itemId, quantity));
      return { reservationId };
    },

    release(reservationId: string): void {
      runOrThrow(effects.releaseEffect(reservationId));
    },

    confirm(reservationId: string): void {
      runOrThrow(effects.confirmEffect(reservationId));
    },

    getAvailable(itemId: string): number {
      return runOrThrow(effects.getAvailableEffect(itemId));
    },

    addStock(itemId: string, quantity: number): void {
      if (quantity < 0) {
        throw new Error("Cannot add negative stock");
      }
      runOrThrow(effects.addStockEffect(itemId, quantity));
    },

    getReservations(itemId: string): Array<{ id: string; quantity: number }> {
      const result: Array<{ id: string; quantity: number }> = [];
      for (const r of reservations.values()) {
        if (r.itemId === itemId) {
          result.push({ id: r.id, quantity: r.quantity });
        }
      }
      return result;
    },

    getTotalStock(itemId: string): number {
      return runOrThrow(effects.getTotalStockEffect(itemId));
    },
  };
}