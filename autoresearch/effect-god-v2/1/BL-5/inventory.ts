import { Effect, Data, Exit, Cause } from "effect";
import * as crypto from "crypto";

// ─── Internal tagged errors ───────────────────────────────────────────────────

class InternalInsufficientStock extends Data.TaggedError("InternalInsufficientStock")<{
  sku: string;
  requested: number;
  available: number;
}> {}

class InternalReservationNotFound extends Data.TaggedError("InternalReservationNotFound")<{
  id: string;
}> {}

class InternalSkuNotFound extends Data.TaggedError("InternalSkuNotFound")<{
  sku: string;
}> {}

class InternalAlreadyFinalized extends Data.TaggedError("InternalAlreadyFinalized")<{
  id: string;
  status: string;
}> {}

// ─── Public error classes ─────────────────────────────────────────────────────

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
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

export class ReservationNotFoundError extends Error {
  readonly reservationId: string;

  constructor(id: string) {
    super(`Reservation not found: "${id}"`);
    this.name = "ReservationNotFoundError";
    this.reservationId = id;
    Object.setPrototypeOf(this, ReservationNotFoundError.prototype);
  }
}

export class SkuNotFoundError extends Error {
  readonly sku: string;

  constructor(sku: string) {
    super(`SKU not found: "${sku}"`);
    this.name = "SkuNotFoundError";
    this.sku = sku;
    Object.setPrototypeOf(this, SkuNotFoundError.prototype);
  }
}

export class ReservationFinalizedError extends Error {
  readonly reservationId: string;
  readonly status: string;

  constructor(id: string, status: string) {
    super(`Reservation "${id}" is already ${status} and cannot be modified`);
    this.name = "ReservationFinalizedError";
    this.reservationId = id;
    this.status = status;
    Object.setPrototypeOf(this, ReservationFinalizedError.prototype);
  }
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export type ReservationStatus = "active" | "confirmed" | "released";

export interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: Date;
}

export interface InventoryItem {
  sku: string;
  totalStock: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface Inventory {
  addStock(sku: string, quantity: number): void;
  removeStock(sku: string, quantity: number): void;
  getAvailable(sku: string): number;
  getTotalStock(sku: string): number;
  getReservedQuantity(sku: string): number;
  getItem(sku: string): InventoryItem | undefined;
  listItems(): InventoryItem[];
  reserve(sku: string, quantity: number): string;
  release(reservationId: string): void;
  confirm(reservationId: string): void;
  getReservation(reservationId: string): Reservation | undefined;
  listReservations(sku?: string): Reservation[];
  listActiveReservations(sku?: string): Reservation[];
}

// ─── Internal state ───────────────────────────────────────────────────────────

interface StockEntry {
  totalStock: number;
  reservedQuantity: number;
}

// ─── Effect-based business logic ──────────────────────────────────────────────

type InternalError =
  | InternalInsufficientStock
  | InternalReservationNotFound
  | InternalSkuNotFound
  | InternalAlreadyFinalized;

function getAvailableInternal(
  stock: Map<string, StockEntry>,
  sku: string
): Effect.Effect<number, InternalSkuNotFound> {
  return Effect.gen(function* () {
    const entry = stock.get(sku);
    if (entry === undefined) {
      yield* Effect.fail(new InternalSkuNotFound({ sku }));
    }
    return entry!.totalStock - entry!.reservedQuantity;
  });
}

function reserveInternal(
  stock: Map<string, StockEntry>,
  reservations: Map<string, Reservation>,
  sku: string,
  quantity: number
): Effect.Effect<string, InternalInsufficientStock | InternalSkuNotFound> {
  return Effect.gen(function* () {
    const entry = stock.get(sku);
    if (entry === undefined) {
      yield* Effect.fail(new InternalSkuNotFound({ sku }));
      return "";
    }
    const available = entry.totalStock - entry.reservedQuantity;
    if (quantity > available) {
      yield* Effect.fail(
        new InternalInsufficientStock({ sku, requested: quantity, available })
      );
      return "";
    }
    entry.reservedQuantity += quantity;
    const id = crypto.randomUUID();
    const reservation: Reservation = {
      id,
      sku,
      quantity,
      status: "active",
      createdAt: new Date(),
    };
    reservations.set(id, reservation);
    return id;
  });
}

function releaseInternal(
  stock: Map<string, StockEntry>,
  reservations: Map<string, Reservation>,
  reservationId: string
): Effect.Effect<void, InternalReservationNotFound | InternalAlreadyFinalized> {
  return Effect.gen(function* () {
    const reservation = reservations.get(reservationId);
    if (reservation === undefined) {
      yield* Effect.fail(new InternalReservationNotFound({ id: reservationId }));
      return;
    }
    if (reservation.status !== "active") {
      yield* Effect.fail(
        new InternalAlreadyFinalized({ id: reservationId, status: reservation.status })
      );
      return;
    }
    const entry = stock.get(reservation.sku);
    if (entry !== undefined) {
      entry.reservedQuantity -= reservation.quantity;
      if (entry.reservedQuantity < 0) entry.reservedQuantity = 0;
    }
    reservation.status = "released";
  });
}

function confirmInternal(
  stock: Map<string, StockEntry>,
  reservations: Map<string, Reservation>,
  reservationId: string
): Effect.Effect<void, InternalReservationNotFound | InternalAlreadyFinalized> {
  return Effect.gen(function* () {
    const reservation = reservations.get(reservationId);
    if (reservation === undefined) {
      yield* Effect.fail(new InternalReservationNotFound({ id: reservationId }));
      return;
    }
    if (reservation.status !== "active") {
      yield* Effect.fail(
        new InternalAlreadyFinalized({ id: reservationId, status: reservation.status })
      );
      return;
    }
    const entry = stock.get(reservation.sku);
    if (entry !== undefined) {
      // Permanently deduct: remove from both total and reserved
      entry.totalStock -= reservation.quantity;
      entry.reservedQuantity -= reservation.quantity;
      if (entry.reservedQuantity < 0) entry.reservedQuantity = 0;
      if (entry.totalStock < 0) entry.totalStock = 0;
    }
    reservation.status = "confirmed";
  });
}

// ─── Boundary helper ──────────────────────────────────────────────────────────

function runEffect<A>(effect: Effect.Effect<A, InternalError>): A {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;

  const raw = Cause.squash(exit.cause);

  if (raw instanceof InternalInsufficientStock) {
    throw new InsufficientStockError(raw.sku, raw.requested, raw.available);
  }
  if (raw instanceof InternalReservationNotFound) {
    throw new ReservationNotFoundError(raw.id);
  }
  if (raw instanceof InternalSkuNotFound) {
    throw new SkuNotFoundError(raw.sku);
  }
  if (raw instanceof InternalAlreadyFinalized) {
    throw new ReservationFinalizedError(raw.id, raw.status);
  }

  const msg = raw instanceof Error ? raw.message : String(raw);
  throw new Error(msg);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createInventory(
  initialStock: Record<string, number> = {}
): Inventory {
  // Validate initial stock
  for (const [sku, qty] of Object.entries(initialStock)) {
    if (qty < 0) {
      throw new Error(`Initial stock for SKU "${sku}" cannot be negative`);
    }
  }

  const stock = new Map<string, StockEntry>();
  const reservations = new Map<string, Reservation>();

  // Populate from initial stock
  for (const [sku, qty] of Object.entries(initialStock)) {
    stock.set(sku, { totalStock: qty, reservedQuantity: 0 });
  }

  function ensureEntry(sku: string): StockEntry {
    if (!stock.has(sku)) {
      stock.set(sku, { totalStock: 0, reservedQuantity: 0 });
    }
    return stock.get(sku)!;
  }

  return {
    addStock(sku: string, quantity: number): void {
      if (quantity < 0) throw new Error("Quantity to add cannot be negative");
      const entry = ensureEntry(sku);
      entry.totalStock += quantity;
    },

    removeStock(sku: string, quantity: number): void {
      if (quantity < 0) throw new Error("Quantity to remove cannot be negative");
      const entry = stock.get(sku);
      if (entry === undefined) throw new SkuNotFoundError(sku);
      const available = entry.totalStock - entry.reservedQuantity;
      if (quantity > available) {
        throw new InsufficientStockError(sku, quantity, available);
      }
      entry.totalStock -= quantity;
    },

    getAvailable(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return Math.max(0, entry.totalStock - entry.reservedQuantity);
    },

    getTotalStock(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return entry.totalStock;
    },

    getReservedQuantity(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return entry.reservedQuantity;
    },

    getItem(sku: string): InventoryItem | undefined {
      const entry = stock.get(sku);
      if (entry === undefined) return undefined;
      return {
        sku,
        totalStock: entry.totalStock,
        reservedQuantity: entry.reservedQuantity,
        availableQuantity: Math.max(0, entry.totalStock - entry.reservedQuantity),
      };
    },

    listItems(): InventoryItem[] {
      return Array.from(stock.entries()).map(([sku, entry]) => ({
        sku,
        totalStock: entry.totalStock,
        reservedQuantity: entry.reservedQuantity,
        availableQuantity: Math.max(0, entry.totalStock - entry.reservedQuantity),
      }));
    },

    reserve(sku: string, quantity: number): string {
      if (quantity <= 0) throw new Error("Reservation quantity must be positive");
      // Auto-create entry if SKU not found to avoid SkuNotFound on reserve
      ensureEntry(sku);
      return runEffect(reserveInternal(stock, reservations, sku, quantity));
    },

    release(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");
      runEffect(releaseInternal(stock, reservations, reservationId));
    },

    confirm(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");
      runEffect(confirmInternal(stock, reservations, reservationId));
    },

    getReservation(reservationId: string): Reservation | undefined {
      return reservations.get(reservationId);
    },

    listReservations(sku?: string): Reservation[] {
      const all = Array.from(reservations.values());
      return sku ? all.filter((r) => r.sku === sku) : all;
    },

    listActiveReservations(sku?: string): Reservation[] {
      const all = Array.from(reservations.values()).filter(
        (r) => r.status === "active"
      );
      return sku ? all.filter((r) => r.sku === sku) : all;
    },
  };
}

// ─── Standalone utility: reconstruct available from event log ─────────────────

export type InventoryEvent =
  | { type: "stock_added"; sku: string; quantity: number }
  | { type: "stock_removed"; sku: string; quantity: number }
  | { type: "reserved"; sku: string; quantity: number; reservationId: string }
  | { type: "released"; sku: string; quantity: number; reservationId: string }
  | { type: "confirmed"; sku: string; quantity: number; reservationId: string };

export interface SkuState {
  totalStock: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export function reconstructFromEvents(
  events: InventoryEvent[]
): Map<string, SkuState> {
  // Valid to pass empty array — represents no history → empty state
  const state = new Map<string, { total: number; reserved: number }>();

  function ensureSku(sku: string) {
    if (!state.has(sku)) state.set(sku, { total: 0, reserved: 0 });
    return state.get(sku)!;
  }

  for (const event of events) {
    switch (event.type) {
      case "stock_added": {
        const s = ensureSku(event.sku);
        s.total += event.quantity;
        break;
      }
      case "stock_removed": {
        const s = ensureSku(event.sku);
        s.total = Math.max(0, s.total - event.quantity);
        break;
      }
      case "reserved": {
        const s = ensureSku(event.sku);
        s.reserved += event.quantity;
        break;
      }
      case "released": {
        const s = ensureSku(event.sku);
        s.reserved = Math.max(0, s.reserved - event.quantity);
        break;
      }
      case "confirmed": {
        const s = ensureSku(event.sku);
        s.total = Math.max(0, s.total - event.quantity);
        s.reserved = Math.max(0, s.reserved - event.quantity);
        break;
      }
    }
  }

  const result = new Map<string, SkuState>();
  for (const [sku, s] of state.entries()) {
    result.set(sku, {
      totalStock: s.total,
      reservedQuantity: s.reserved,
      availableQuantity: Math.max(0, s.total - s.reserved),
    });
  }
  return result;
}

// ─── Snapshot support ─────────────────────────────────────────────────────────

export interface InventorySnapshot {
  items: Array<{ sku: string; totalStock: number; reservedQuantity: number }>;
  reservations: Reservation[];
}

export function createInventoryFromSnapshot(snapshot: InventorySnapshot): Inventory {
  const initialStock: Record<string, number> = {};
  for (const item of snapshot.items) {
    initialStock[item.sku] = item.totalStock;
  }

  const inv = createInventory(initialStock);

  // Restore reservation state by adjusting internal stock
  // We use addStock/access internal state via the factory approach
  // Re-apply reservedQuantity by accessing through getItem comparisons
  // Since we can't directly set reservedQuantity, we re-create via a fresh approach
  const stock = new Map<string, StockEntry>();
  const reservations = new Map<string, Reservation>();

  for (const item of snapshot.items) {
    stock.set(item.sku, {
      totalStock: item.totalStock,
      reservedQuantity: item.reservedQuantity,
    });
  }

  for (const r of snapshot.reservations) {
    reservations.set(r.id, { ...r });
  }

  // Return a new inventory with restored state
  return buildInventoryFromMaps(stock, reservations);
}

function buildInventoryFromMaps(
  stock: Map<string, StockEntry>,
  reservations: Map<string, Reservation>
): Inventory {
  function ensureEntry(sku: string): StockEntry {
    if (!stock.has(sku)) {
      stock.set(sku, { totalStock: 0, reservedQuantity: 0 });
    }
    return stock.get(sku)!;
  }

  return {
    addStock(sku: string, quantity: number): void {
      if (quantity < 0) throw new Error("Quantity to add cannot be negative");
      const entry = ensureEntry(sku);
      entry.totalStock += quantity;
    },

    removeStock(sku: string, quantity: number): void {
      if (quantity < 0) throw new Error("Quantity to remove cannot be negative");
      const entry = stock.get(sku);
      if (entry === undefined) throw new SkuNotFoundError(sku);
      const available = entry.totalStock - entry.reservedQuantity;
      if (quantity > available) {
        throw new InsufficientStockError(sku, quantity, available);
      }
      entry.totalStock -= quantity;
    },

    getAvailable(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return Math.max(0, entry.totalStock - entry.reservedQuantity);
    },

    getTotalStock(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return entry.totalStock;
    },

    getReservedQuantity(sku: string): number {
      const entry = stock.get(sku);
      if (entry === undefined) return 0;
      return entry.reservedQuantity;
    },

    getItem(sku: string): InventoryItem | undefined {
      const entry = stock.get(sku);
      if (entry === undefined) return undefined;
      return {
        sku,
        totalStock: entry.totalStock,
        reservedQuantity: entry.reservedQuantity,
        availableQuantity: Math.max(0, entry.totalStock - entry.reservedQuantity),
      };
    },

    listItems(): InventoryItem[] {
      return Array.from(stock.entries()).map(([sku, entry]) => ({
        sku,
        totalStock: entry.totalStock,
        reservedQuantity: entry.reservedQuantity,
        availableQuantity: Math.max(0, entry.totalStock - entry.reservedQuantity),
      }));
    },

    reserve(sku: string, quantity: number): string {
      if (quantity <= 0) throw new Error("Reservation quantity must be positive");
      ensureEntry(sku);
      return runEffect(reserveInternal(stock, reservations, sku, quantity));
    },

    release(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");
      runEffect(releaseInternal(stock, reservations, reservationId));
    },

    confirm(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");
      runEffect(confirmInternal(stock, reservations, reservationId));
    },

    getReservation(reservationId: string): Reservation | undefined {
      return reservations.get(reservationId);
    },

    listReservations(sku?: string): Reservation[] {
      const all = Array.from(reservations.values());
      return sku ? all.filter((r) => r.sku === sku) : all;
    },

    listActiveReservations(sku?: string): Reservation[] {
      const all = Array.from(reservations.values()).filter(
        (r) => r.status === "active"
      );
      return sku ? all.filter((r) => r.sku === sku) : all;
    },
  };
}