import { Effect, Data, Exit, Cause } from "effect";

class InventoryError extends Data.TaggedError("InventoryError")<{ reason: string }> {}

interface Reservation {
  id: string;
  sku: string;
  qty: number;
  expireTime?: number;
}

interface Inventory {
  setStock(sku: string, qty: number): void;
  getAvailable(sku: string): number;
  reserve(sku: string, qty: number, ttl?: number): string;
  release(id: string): void;
  confirm(id: string): void;
}

const createInventoryInternal = (): Effect.Effect<Inventory, never> => {
  return Effect.gen(function* () {
    const stock = new Map<string, number>();
    const reservations = new Map<string, Reservation>();
    let nextId = 0;

    // Auto-cleanup expired reservations
    const cleanupExpired = () => {
      const now = Date.now();
      const expired: string[] = [];
      for (const [id, res] of reservations.entries()) {
        if (res.expireTime !== undefined && res.expireTime <= now) {
          expired.push(id);
        }
      }
      for (const id of expired) {
        reservations.delete(id);
      }
    };

    const inventory: Inventory = {
      setStock(sku: string, qty: number): void {
        if (qty < 0) {
          throw new InventoryError({ reason: "Stock cannot be negative" });
        }
        stock.set(sku, qty);
      },

      getAvailable(sku: string): number {
        cleanupExpired();
        const totalStock = stock.get(sku) ?? 0;
        let reserved = 0;
        for (const res of reservations.values()) {
          if (res.sku === sku) {
            reserved += res.qty;
          }
        }
        return totalStock - reserved;
      },

      reserve(sku: string, qty: number, ttl?: number): string {
        if (qty < 0) {
          throw new InventoryError({ reason: "Quantity cannot be negative" });
        }
        cleanupExpired();
        const available = this.getAvailable(sku);
        if (qty > available) {
          throw new InventoryError({
            reason: `Insufficient stock for ${sku}: need ${qty}, have ${available}`,
          });
        }
        const id = `res_${nextId++}`;
        const expireTime = ttl !== undefined ? Date.now() + ttl : undefined;
        reservations.set(id, { id, sku, qty, expireTime });
        return id;
      },

      release(id: string): void {
        reservations.delete(id);
      },

      confirm(id: string): void {
        const res = reservations.get(id);
        if (!res) {
          throw new InventoryError({ reason: `Reservation ${id} not found` });
        }
        const current = stock.get(res.sku) ?? 0;
        stock.set(res.sku, current - res.qty);
        reservations.delete(id);
      },
    };

    return inventory;
  });
};

export function createInventory(): Inventory {
  const exit = Effect.runSyncExit(createInventoryInternal());
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
}

export { InventoryError };