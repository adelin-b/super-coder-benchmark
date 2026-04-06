import { Effect, Data } from "effect";

class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

class InternalError extends Data.TaggedError("InternalError")<{
  message: string;
}> {}

interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  expiresAt?: number;
}

interface InventoryState {
  stock: Map<string, number>;
  reservations: Map<string, Reservation>;
}

function createInventory() {
  const state: InventoryState = {
    stock: new Map(),
    reservations: new Map(),
  };

  function cleanExpiredReservations(): void {
    const now = Date.now();
    for (const [id, reservation] of state.reservations.entries()) {
      if (
        reservation.expiresAt !== undefined &&
        reservation.expiresAt <= now
      ) {
        state.reservations.delete(id);
      }
    }
  }

  function getReservedAmount(sku: string): number {
    let reserved = 0;
    for (const reservation of state.reservations.values()) {
      if (reservation.sku === sku) {
        reserved += reservation.quantity;
      }
    }
    return reserved;
  }

  function setStock(sku: string, quantity: number): void {
    if (quantity < 0) {
      throw new InventoryError("Stock quantity cannot be negative");
    }
    state.stock.set(sku, quantity);
  }

  function getAvailable(sku: string): number {
    cleanExpiredReservations();
    const total = state.stock.get(sku) || 0;
    const reserved = getReservedAmount(sku);
    return Math.max(0, total - reserved);
  }

  function reserve(sku: string, quantity: number, ttl?: number): string {
    if (quantity < 0) {
      throw new InventoryError("Reservation quantity cannot be negative");
    }
    if (quantity === 0) {
      throw new InventoryError("Reservation quantity must be positive");
    }

    cleanExpiredReservations();

    const available = getAvailable(sku);
    if (available < quantity) {
      throw new InventoryError(
        `Insufficient stock for ${sku}. Available: ${available}, Requested: ${quantity}`
      );
    }

    const id = crypto.randomUUID();
    const reservation: Reservation = {
      id,
      sku,
      quantity,
      expiresAt: ttl !== undefined ? Date.now() + ttl : undefined,
    };

    state.reservations.set(id, reservation);
    return id;
  }

  function release(reservationId: string): void {
    state.reservations.delete(reservationId);
  }

  function confirm(reservationId: string): void {
    const reservation = state.reservations.get(reservationId);
    if (!reservation) {
      throw new InventoryError(`Reservation ${reservationId} not found`);
    }

    const currentStock = state.stock.get(reservation.sku) || 0;
    state.stock.set(reservation.sku, currentStock - reservation.quantity);
    state.reservations.delete(reservationId);
  }

  return {
    setStock,
    getAvailable,
    reserve,
    release,
    confirm,
  };
}

export { createInventory, InventoryError };