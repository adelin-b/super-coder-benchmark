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

interface InventoryState {
  stock: Map<string, number>;
  reservations: Map<string, Reservation>;
}

interface Inventory {
  setStock(sku: string, quantity: number): void;
  getAvailable(sku: string): number;
  reserve(sku: string, quantity: number, ttlMs?: number): string;
  release(id: string): void;
  confirm(id: string): void;
}

function createInventoryInternal(): Effect.Effect<Inventory, never> {
  return Effect.gen(function* () {
    const state: InventoryState = {
      stock: new Map(),
      reservations: new Map(),
    };

    const generateId = () => crypto.randomUUID();

    const cleanExpiredReservations = () => {
      const now = Date.now();
      const toDelete: string[] = [];
      for (const [id, res] of state.reservations.entries()) {
        if (res.expiresAt !== undefined && res.expiresAt <= now) {
          toDelete.push(id);
        }
      }
      for (const id of toDelete) {
        state.reservations.delete(id);
      }
    };

    const inventory: Inventory = {
      setStock(sku: string, quantity: number): void {
        if (quantity < 0) {
          throw new InventoryError("Stock quantity cannot be negative");
        }
        state.stock.set(sku, quantity);
      },

      getAvailable(sku: string): number {
        cleanExpiredReservations();
        const total = state.stock.get(sku) ?? 0;
        let reserved = 0;
        for (const res of state.reservations.values()) {
          if (res.sku === sku) {
            reserved += res.quantity;
          }
        }
        return Math.max(0, total - reserved);
      },

      reserve(sku: string, quantity: number, ttlMs?: number): string {
        if (quantity < 0) {
          throw new InventoryError("Reserve quantity cannot be negative");
        }
        if (quantity === 0) {
          throw new InventoryError("Reserve quantity must be greater than 0");
        }

        cleanExpiredReservations();

        const available = this.getAvailable(sku);
        if (available < quantity) {
          throw new InventoryError(
            `Insufficient stock for ${sku}: available ${available}, requested ${quantity}`
          );
        }

        const id = generateId();
        const reservation: Reservation = {
          id,
          sku,
          quantity,
          expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : undefined,
        };
        state.reservations.set(id, reservation);
        return id;
      },

      release(id: string): void {
        state.reservations.delete(id);
      },

      confirm(id: string): void {
        const res = state.reservations.get(id);
        if (!res) {
          throw new InventoryError(`Reservation ${id} not found`);
        }
        const current = state.stock.get(res.sku) ?? 0;
        state.stock.set(res.sku, current - res.quantity);
        state.reservations.delete(id);
      },
    };

    return inventory;
  });
}

export function createInventory(): Inventory {
  try {
    return Effect.runSync(createInventoryInternal());
  } catch (e: unknown) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

export { InventoryError };