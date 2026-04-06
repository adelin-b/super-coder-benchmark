import { Effect, Data } from "effect";

class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  expiresAt?: number;
}

interface SkuState {
  total: number;
  reserved: Map<string, number>; // reservationId -> quantity
  confirmed: number;
}

interface InventoryState {
  skus: Map<string, SkuState>;
  reservations: Map<string, Reservation>;
  nextReservationId: number;
}

function createInventoryState(): InventoryState {
  return {
    skus: new Map(),
    reservations: new Map(),
    nextReservationId: 0,
  };
}

function getOrCreateSku(state: InventoryState, sku: string): SkuState {
  if (!state.skus.has(sku)) {
    state.skus.set(sku, {
      total: 0,
      reserved: new Map(),
      confirmed: 0,
    });
  }
  return state.skus.get(sku)!;
}

function getAvailableInternal(skuState: SkuState | undefined): number {
  if (!skuState) return 0;
  const reservedQty = Array.from(skuState.reserved.values()).reduce(
    (sum, qty) => sum + qty,
    0
  );
  return Math.max(0, skuState.total - skuState.confirmed - reservedQty);
}

function cleanupExpiredReservations(state: InventoryState): void {
  const now = Date.now();
  const expiredIds: string[] = [];

  for (const [id, reservation] of state.reservations.entries()) {
    if (reservation.expiresAt && reservation.expiresAt <= now) {
      expiredIds.push(id);
    }
  }

  for (const id of expiredIds) {
    const reservation = state.reservations.get(id)!;
    const skuState = state.skus.get(reservation.sku);
    if (skuState) {
      skuState.reserved.delete(id);
    }
    state.reservations.delete(id);
  }
}

function createInventory() {
  const state = createInventoryState();

  const setStock = (sku: string, quantity: number): void => {
    const skuState = getOrCreateSku(state, sku);
    skuState.total = quantity;
  };

  const getAvailable = (sku: string): number => {
    cleanupExpiredReservations(state);
    const skuState = state.skus.get(sku);
    return getAvailableInternal(skuState);
  };

  const reserve = (sku: string, quantity: number, ttlMs?: number): string => {
    if (quantity < 0) {
      throw new InventoryError("Quantity cannot be negative");
    }

    cleanupExpiredReservations(state);

    const skuState = getOrCreateSku(state, sku);
    const available = getAvailableInternal(skuState);

    if (quantity > available) {
      throw new InventoryError(
        `Insufficient stock: requested ${quantity}, available ${available}`
      );
    }

    const id = String(state.nextReservationId++);
    const reservation: Reservation = {
      id,
      sku,
      quantity,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    state.reservations.set(id, reservation);
    skuState.reserved.set(id, quantity);

    // Schedule auto-release if TTL is set
    if (ttlMs) {
      setTimeout(() => {
        cleanupExpiredReservations(state);
      }, ttlMs + 5); // Small buffer to ensure cleanup
    }

    return id;
  };

  const release = (id: string): void => {
    const reservation = state.reservations.get(id);
    if (!reservation) {
      throw new InventoryError(`Reservation not found: ${id}`);
    }

    const skuState = state.skus.get(reservation.sku);
    if (skuState) {
      skuState.reserved.delete(id);
    }

    state.reservations.delete(id);
  };

  const confirm = (id: string): void => {
    const reservation = state.reservations.get(id);
    if (!reservation) {
      throw new InventoryError(`Reservation not found: ${id}`);
    }

    const skuState = state.skus.get(reservation.sku);
    if (skuState) {
      skuState.reserved.delete(id);
      skuState.confirmed += reservation.quantity;
    }

    state.reservations.delete(id);
  };

  return {
    setStock,
    getAvailable,
    reserve,
    release,
    confirm,
  };
}

export { createInventory, InventoryError };