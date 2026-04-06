import { Effect, Data } from "effect";
import { crypto } from "node:crypto";

class InsufficientStockError extends Data.TaggedError("InsufficientStockError")<{
  sku: string;
  requested: number;
  available: number;
}> {}

class ReservationNotFoundError extends Data.TaggedError("ReservationNotFoundError")<{
  reservationId: string;
}> {}

interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  status: "pending" | "confirmed" | "released";
}

interface InventoryState {
  stock: Map<string, number>;
  reservations: Map<string, Reservation>;
}

function createInventoryEffect() {
  const state: InventoryState = {
    stock: new Map(),
    reservations: new Map(),
  };

  return {
    setStock: (sku: string, qty: number) =>
      Effect.sync(() => {
        if (typeof qty !== "number" || qty < 0) {
          throw new Error("Quantity must be a non-negative number");
        }
        state.stock.set(sku, qty);
      }),

    getAvailable: (sku: string) =>
      Effect.sync(() => {
        const stock = state.stock.get(sku) ?? 0;
        const reserved = Array.from(state.reservations.values())
          .filter((r) => r.sku === sku && r.status === "pending")
          .reduce((sum, r) => sum + r.quantity, 0);
        return Math.max(0, stock - reserved);
      }),

    reserve: (sku: string, qty: number) =>
      Effect.gen(function* () {
        if (typeof qty !== "number" || qty <= 0) {
          yield* Effect.fail(
            new Error("Quantity must be a positive number")
          );
        }
        const available = yield* Effect.sync(() => {
          const stock = state.stock.get(sku) ?? 0;
          const reserved = Array.from(state.reservations.values())
            .filter((r) => r.sku === sku && r.status === "pending")
            .reduce((sum, r) => sum + r.quantity, 0);
          return Math.max(0, stock - reserved);
        });

        if (available < qty) {
          yield* Effect.fail(
            new InsufficientStockError({
              sku,
              requested: qty,
              available,
            })
          );
        }

        return yield* Effect.sync(() => {
          const reservationId = crypto.randomUUID();
          const reservation: Reservation = {
            id: reservationId,
            sku,
            quantity: qty,
            status: "pending",
          };
          state.reservations.set(reservationId, reservation);
          return reservationId;
        });
      }),

    release: (reservationId: string) =>
      Effect.gen(function* () {
        const reservation = state.reservations.get(reservationId);
        if (!reservation) {
          yield* Effect.fail(
            new ReservationNotFoundError({ reservationId })
          );
        }
        return yield* Effect.sync(() => {
          const res = state.reservations.get(reservationId);
          if (res) {
            res.status = "released";
          }
          return void 0;
        });
      }),

    confirm: (reservationId: string) =>
      Effect.gen(function* () {
        const reservation = state.reservations.get(reservationId);
        if (!reservation) {
          yield* Effect.fail(
            new ReservationNotFoundError({ reservationId })
          );
        }
        return yield* Effect.sync(() => {
          const res = state.reservations.get(reservationId);
          if (res) {
            res.status = "confirmed";
            const current = state.stock.get(res.sku) ?? 0;
            state.stock.set(res.sku, Math.max(0, current - res.quantity));
          }
          return void 0;
        });
      }),
  };
}

export function createInventory() {
  const inventoryEffect = createInventoryEffect();

  return {
    setStock(sku: string, qty: number): void {
      Effect.runSync(inventoryEffect.setStock(sku, qty));
    },

    getAvailable(sku: string): number {
      return Effect.runSync(inventoryEffect.getAvailable(sku));
    },

    reserve(sku: string, qty: number): string {
      try {
        return Effect.runSync(inventoryEffect.reserve(sku, qty));
      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
        throw new Error(String(e));
      }
    },

    release(reservationId: string): void {
      try {
        Effect.runSync(inventoryEffect.release(reservationId));
      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
        throw new Error(String(e));
      }
    },

    confirm(reservationId: string): void {
      try {
        Effect.runSync(inventoryEffect.confirm(reservationId));
      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
        throw new Error(String(e));
      }
    },
  };
}