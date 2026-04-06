import { Effect, Data } from "effect";

class ItemNotFound extends Data.TaggedError("ItemNotFound")<{
  itemId: string;
}> {}

class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  itemId: string;
  available: number;
  requested: number;
}> {}

class InvalidQuantity extends Data.TaggedError("InvalidQuantity")<{
  reason: string;
}> {}

interface InventoryItem {
  id: string;
  available: number;
  reserved: number;
}

export class InventoryReservationSystem {
  private items: Map<string, InventoryItem> = new Map();

  addItem(id: string, quantity: number): void {
    if (quantity < 0) throw new Error("quantity cannot be negative");
    this.items.set(id, { id, available: quantity, reserved: 0 });
  }

  reserve(itemId: string, quantity: number): boolean {
    const effect = Effect.gen(function* () {
      if (quantity < 0) {
        yield* Effect.fail(
          new InvalidQuantity({ reason: "quantity cannot be negative" })
        );
      }

      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }

      if (item!.available >= quantity) {
        item!.available -= quantity;
        item!.reserved += quantity;
        return true;
      }
      return false;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error during reservation");
    }
  }

  release(itemId: string, quantity: number): void {
    const effect = Effect.gen(function* () {
      if (quantity < 0) {
        yield* Effect.fail(
          new InvalidQuantity({ reason: "quantity cannot be negative" })
        );
      }

      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }

      if (item!.reserved < quantity) {
        yield* Effect.fail(
          new InvalidQuantity({
            reason: "cannot release more than reserved",
          })
        );
      }

      item!.reserved -= quantity;
      item!.available += quantity;
    });

    try {
      Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error during release");
    }
  }

  checkAvailability(itemId: string): number {
    const effect = Effect.gen(function* () {
      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }
      return item!.available;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error checking availability");
    }
  }

  getReserved(itemId: string): number {
    const effect = Effect.gen(function* () {
      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }
      return item!.reserved;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error getting reserved count");
    }
  }

  getTotalStock(itemId: string): number {
    const effect = Effect.gen(function* () {
      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }
      return item!.available + item!.reserved;
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error getting total stock");
    }
  }

  cancel(itemId: string, quantity: number): void {
    this.release(itemId, quantity);
  }

  getItemSnapshot(itemId: string): InventoryItem {
    const effect = Effect.gen(function* () {
      const item = this.items.get(itemId);
      if (!item) {
        yield* Effect.fail(new ItemNotFound({ itemId }));
      }
      return { ...item! };
    });

    try {
      return Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Unknown error getting item snapshot");
    }
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }
}

export function createInventoryReservationSystem(): InventoryReservationSystem {
  return new InventoryReservationSystem();
}