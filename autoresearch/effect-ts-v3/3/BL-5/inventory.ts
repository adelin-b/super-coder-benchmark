import { Effect, pipe, Data } from "effect";
import { crypto } from "node:crypto";

// Internal: Typed error for invalid operations
class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  itemId: string;
  available: number;
  requested: number;
}> {}

class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  reservationId: string;
}> {}

class ItemNotFound extends Data.TaggedError("ItemNotFound")<{
  itemId: string;
}> {}

// Internal state
interface InventoryItem {
  total: number;
  reserved: number;
}

interface Reservation {
  itemId: string;
  quantity: number;
}

class InventoryManager {
  private items: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();

  constructor(initialItems?: Map<string, number>) {
    if (initialItems) {
      for (const [itemId, quantity] of initialItems) {
        this.items.set(itemId, { total: quantity, reserved: 0 });
      }
    }
  }

  // Internal: Effect-based reserve
  private reserveEffect(
    itemId: string,
    quantity: number
  ): Effect.Effect<string, InsufficientStock | ItemNotFound> {
    return Effect.sync(() => {
      const item = this.items.get(itemId);
      if (!item) {
        return Effect.fail(new ItemNotFound({ itemId }));
      }

      const available = item.total - item.reserved;
      if (available < quantity) {
        return Effect.fail(
          new InsufficientStock({ itemId, available, requested: quantity })
        );
      }

      const reservationId = crypto.randomUUID();
      item.reserved += quantity;
      this.reservations.set(reservationId, { itemId, quantity });
      return Effect.succeed(reservationId);
    }).pipe(Effect.flatMap((x) => x));
  }

  // Internal: Effect-based release
  private releaseEffect(
    reservationId: string
  ): Effect.Effect<void, ReservationNotFound> {
    return Effect.sync(() => {
      const reservation = this.reservations.get(reservationId);
      if (!reservation) {
        return Effect.fail(new ReservationNotFound({ reservationId }));
      }

      const item = this.items.get(reservation.itemId);
      if (item) {
        item.reserved -= reservation.quantity;
      }
      this.reservations.delete(reservationId);
      return Effect.succeed(void 0);
    }).pipe(Effect.flatMap((x) => x));
  }

  // Public: reserve stock
  reserve(itemId: string, quantity: number): string {
    if (quantity <= 0) throw new Error("quantity must be positive");
    return Effect.runSync(this.reserveEffect(itemId, quantity));
  }

  // Public: release a reservation
  release(reservationId: string): void {
    Effect.runSync(this.releaseEffect(reservationId));
  }

  // Public: check available stock
  checkAvailability(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);
    return item.total - item.reserved;
  }

  // Public: get total reserved for an item
  getReserved(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);
    return item.reserved;
  }

  // Public: get total stock for an item
  getTotal(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);
    return item.total;
  }

  // Public: add stock to an item
  addStock(itemId: string, quantity: number): void {
    if (quantity <= 0) throw new Error("quantity must be positive");
    if (!this.items.has(itemId)) {
      this.items.set(itemId, { total: quantity, reserved: 0 });
    } else {
      const item = this.items.get(itemId)!;
      item.total += quantity;
    }
  }

  // Public: create new item with initial stock
  createItem(itemId: string, quantity: number): void {
    if (quantity < 0) throw new Error("quantity must be non-negative");
    if (this.items.has(itemId)) {
      throw new Error(`Item ${itemId} already exists`);
    }
    this.items.set(itemId, { total: quantity, reserved: 0 });
  }
}

// Exported factory
export function createInventory(
  initialItems?: Map<string, number>
): InventoryManager {
  return new InventoryManager(initialItems);
}

// Exported class for type reference
export { InventoryManager };