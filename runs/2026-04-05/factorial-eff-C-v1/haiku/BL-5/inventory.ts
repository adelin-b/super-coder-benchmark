import { Effect, Ref } from "effect";

// Domain errors
class InsufficientStockError extends Error {
  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

// Exported types
export interface InventoryItem {
  id: string;
  quantity: number;
  reserved: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
}

export interface AvailabilityResult {
  itemId: string;
  available: number;
  reserved: number;
  total: number;
}

export interface InventoryManagerConfig {
  items: InventoryItem[];
}

export class InventoryManager {
  private itemsRef: Ref.Ref<Map<string, InventoryItem>>;
  private reservationsRef: Ref.Ref<Map<string, Reservation>>;
  private counterRef: Ref.Ref<number>;

  private constructor(
    itemsRef: Ref.Ref<Map<string, InventoryItem>>,
    reservationsRef: Ref.Ref<Map<string, Reservation>>,
    counterRef: Ref.Ref<number>
  ) {
    this.itemsRef = itemsRef;
    this.reservationsRef = reservationsRef;
    this.counterRef = counterRef;
  }

  static create(config: InventoryManagerConfig): InventoryManager {
    const effect = Effect.gen(function* () {
      const itemsMap = new Map(config.items.map((item) => [item.id, item]));
      const itemsRef = yield* Ref.make(itemsMap);
      const reservationsRef = yield* Ref.make(new Map<string, Reservation>());
      const counterRef = yield* Ref.make(0);

      return new InventoryManager(itemsRef, reservationsRef, counterRef);
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      throw new Error(
        `Failed to create InventoryManager: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  reserve(itemId: string, quantity: number): Reservation {
    const effect = Effect.gen(function* () {
      if (quantity <= 0) {
        return yield* Effect.fail(
          new Error(`Quantity must be positive, got ${quantity}`)
        );
      }

      const items = yield* Ref.get(this.itemsRef);
      const item = items.get(itemId);

      if (!item) {
        return yield* Effect.fail(new ItemNotFoundError(itemId));
      }

      const available = item.quantity - item.reserved;
      if (available < quantity) {
        return yield* Effect.fail(
          new InsufficientStockError(itemId, quantity, available)
        );
      }

      const counter = yield* Ref.getAndUpdate(
        this.counterRef,
        (c) => c + 1
      );
      const reservation: Reservation = {
        id: `RES-${counter}`,
        itemId,
        quantity,
        createdAt: new Date(),
      };

      const updatedItems = new Map(items);
      const updatedItem = { ...item, reserved: item.reserved + quantity };
      updatedItems.set(itemId, updatedItem);
      yield* Ref.set(this.itemsRef, updatedItems);

      const reservations = yield* Ref.get(this.reservationsRef);
      const updatedReservations = new Map(reservations);
      updatedReservations.set(reservation.id, reservation);
      yield* Ref.set(this.reservationsRef, updatedReservations);

      return reservation;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (
        e instanceof InsufficientStockError ||
        e instanceof ItemNotFoundError ||
        e instanceof Error
      ) {
        throw e;
      }
      throw new Error(`Failed to reserve: ${String(e)}`);
    }
  }

  release(reservationId: string): void {
    const effect = Effect.gen(function* () {
      const reservations = yield* Ref.get(this.reservationsRef);
      const reservation = reservations.get(reservationId);

      if (!reservation) {
        return yield* Effect.fail(new ReservationNotFoundError(reservationId));
      }

      const items = yield* Ref.get(this.itemsRef);
      const item = items.get(reservation.itemId);

      if (!item) {
        return yield* Effect.fail(
          new ItemNotFoundError(reservation.itemId)
        );
      }

      const updatedItems = new Map(items);
      const updatedItem = {
        ...item,
        reserved: Math.max(0, item.reserved - reservation.quantity),
      };
      updatedItems.set(reservation.itemId, updatedItem);
      yield* Ref.set(this.itemsRef, updatedItems);

      const updatedReservations = new Map(reservations);
      updatedReservations.delete(reservationId);
      yield* Ref.set(this.reservationsRef, updatedReservations);
    });

    try {
      Effect.runSync(effect);
    } catch (e) {
      if (
        e instanceof ReservationNotFoundError ||
        e instanceof ItemNotFoundError ||
        e instanceof Error
      ) {
        throw e;
      }
      throw new Error(`Failed to release: ${String(e)}`);
    }
  }

  checkAvailability(itemId: string): AvailabilityResult {
    const effect = Effect.gen(function* () {
      const items = yield* Ref.get(this.itemsRef);
      const item = items.get(itemId);

      if (!item) {
        return yield* Effect.fail(new ItemNotFoundError(itemId));
      }

      return {
        itemId,
        available: item.quantity - item.reserved,
        reserved: item.reserved,
        total: item.quantity,
      };
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof ItemNotFoundError || e instanceof Error) {
        throw e;
      }
      throw new Error(`Failed to check availability: ${String(e)}`);
    }
  }

  getInventory(itemId: string): InventoryItem {
    const effect = Effect.gen(function* () {
      const items = yield* Ref.get(this.itemsRef);
      const item = items.get(itemId);

      if (!item) {
        return yield* Effect.fail(new ItemNotFoundError(itemId));
      }

      return item;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof ItemNotFoundError || e instanceof Error) {
        throw e;
      }
      throw new Error(`Failed to get inventory: ${String(e)}`);
    }
  }

  getAllItems(): InventoryItem[] {
    const effect = Effect.gen(function* () {
      const items = yield* Ref.get(this.itemsRef);
      return Array.from(items.values());
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      throw new Error(
        `Failed to get all items: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  async reserveConcurrent(
    reservations: Array<{ itemId: string; quantity: number }>
  ): Promise<Reservation[]> {
    const effect = Effect.gen(function* () {
      const results: Reservation[] = [];
      for (const { itemId, quantity } of reservations) {
        const reservation = this.reserve(itemId, quantity);
        results.push(reservation);
      }
      return results;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      throw new Error(
        `Failed concurrent reservation: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

export class InsufficientStockException extends Error {
  readonly itemId: string;
  readonly requested: number;
  readonly available: number;

  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockException";
    this.itemId = itemId;
    this.requested = requested;
    this.available = available;
  }
}

export class ReservationNotFoundException extends Error {
  readonly reservationId: string;

  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundException";
    this.reservationId = reservationId;
  }
}

export class ItemNotFoundException extends Error {
  readonly itemId: string;

  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundException";
    this.itemId = itemId;
  }
}