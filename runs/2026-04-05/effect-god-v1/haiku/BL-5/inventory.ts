import { Effect, Data, Exit, Cause } from "effect";
import { randomUUID } from "crypto";

// Internal error types (using Data.TaggedError for Effect internals)
class InsufficientStockError extends Data.TaggedError("InsufficientStockError")<{
  itemId: string;
  requested: number;
  available: number;
}> {}

class ReservationNotFoundError extends Data.TaggedError("ReservationNotFoundError")<{
  reservationId: string;
}> {}

class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
  itemId: string;
}> {}

// Export error classes for public use
export class InsufficientStockError extends Error {
  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  reserved: boolean;
}

export interface Inventory {
  reserve(itemId: string, quantity: number): Reservation;
  release(reservationId: string): void;
  confirm(reservationId: string): void;
  getAvailability(itemId: string): number;
  getReservation(reservationId: string): Reservation | undefined;
}

export function createInventory(initialStock: Record<string, number>): Inventory {
  // Validate input
  for (const [itemId, qty] of Object.entries(initialStock)) {
    if (qty < 0) throw new Error(`Stock quantity cannot be negative for item ${itemId}`);
  }

  const stock = new Map(Object.entries(initialStock));
  const reservations = new Map<string, { itemId: string; quantity: number }>();

  const reserveInternal = (
    itemId: string,
    quantity: number
  ): Effect.Effect<Reservation, InsufficientStockError | ItemNotFoundError> => {
    return Effect.gen(function* () {
      if (!stock.has(itemId)) {
        yield* Effect.fail(new ItemNotFoundError({ itemId }));
      }

      const currentStock = stock.get(itemId) || 0;
      const reserved = Array.from(reservations.values()).reduce(
        (sum, res) => (res.itemId === itemId ? sum + res.quantity : sum),
        0
      );
      const available = currentStock - reserved;

      if (available < quantity) {
        yield* Effect.fail(
          new InsufficientStockError({ itemId, requested: quantity, available })
        );
      }

      const reservationId = randomUUID();
      reservations.set(reservationId, { itemId, quantity });

      return {
        id: reservationId,
        itemId,
        quantity,
        reserved: true,
      } as Reservation;
    });
  };

  const releaseInternal = (
    reservationId: string
  ): Effect.Effect<void, ReservationNotFoundError> => {
    return Effect.gen(function* () {
      if (!reservations.has(reservationId)) {
        yield* Effect.fail(new ReservationNotFoundError({ reservationId }));
      }
      reservations.delete(reservationId);
    });
  };

  const confirmInternal = (
    reservationId: string
  ): Effect.Effect<void, ReservationNotFoundError> => {
    return Effect.gen(function* () {
      const reservation = reservations.get(reservationId);
      if (!reservation) {
        yield* Effect.fail(new ReservationNotFoundError({ reservationId }));
      }
      const { itemId, quantity } = reservation!;
      stock.set(itemId, (stock.get(itemId) || 0) - quantity);
      reservations.delete(reservationId);
    });
  };

  return {
    reserve(itemId: string, quantity: number): Reservation {
      if (quantity < 0) throw new Error("Quantity cannot be negative");
      if (quantity === 0) throw new Error("Quantity must be greater than zero");

      const exit = Effect.runSyncExit(reserveInternal(itemId, quantity));
      if (Exit.isFailure(exit)) {
        throw Cause.squash(exit.cause);
      }
      return exit.value;
    },

    release(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");

      const exit = Effect.runSyncExit(releaseInternal(reservationId));
      if (Exit.isFailure(exit)) {
        throw Cause.squash(exit.cause);
      }
    },

    confirm(reservationId: string): void {
      if (!reservationId) throw new Error("Reservation ID is required");

      const exit = Effect.runSyncExit(confirmInternal(reservationId));
      if (Exit.isFailure(exit)) {
        throw Cause.squash(exit.cause);
      }
    },

    getAvailability(itemId: string): number {
      if (!itemId) throw new Error("Item ID is required");

      if (!stock.has(itemId)) {
        throw new ItemNotFoundError(itemId);
      }

      const currentStock = stock.get(itemId) || 0;
      const reserved = Array.from(reservations.values()).reduce(
        (sum, res) => (res.itemId === itemId ? sum + res.quantity : sum),
        0
      );

      return currentStock - reserved;
    },

    getReservation(reservationId: string): Reservation | undefined {
      if (!reservationId) throw new Error("Reservation ID is required");

      const reservation = reservations.get(reservationId);
      if (!reservation) return undefined;

      return {
        id: reservationId,
        itemId: reservation.itemId,
        quantity: reservation.quantity,
        reserved: true,
      };
    },
  };
}