import { Effect, Data, pipe } from "effect";
import { randomUUID } from "crypto";

class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  itemId: string;
  requested: number;
  available: number;
}> {}

class ItemNotFound extends Data.TaggedError("ItemNotFound")<{
  itemId: string;
}> {}

class InvalidInput extends Data.TaggedError("InvalidInput")<{
  reason: string;
}> {}

class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  reservationId: string;
}> {}

interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
}

interface InventoryItem {
  total: number;
  reservations: Map<string, number>;
}

interface InventorySystemImpl {
  addItem(itemId: string, quantity: number): void;
  reserve(itemId: string, quantity: number): string;
  release(reservationId: string): void;
  commit(reservationId: string): void;
  getAvailable(itemId: string): number;
  getReserved(itemId: string): number;
  getTotal(itemId: string): number;
}

function createInventoryInternal(): Effect.Effect<InventorySystemImpl, never> {
  return Effect.sync(() => {
    const items = new Map<string, InventoryItem>();
    const reservationMap = new Map<string, Reservation>();

    const addItemImpl = (itemId: string, quantity: number): Effect.Effect<void, InvalidInput> =>
      Effect.gen(function* () {
        if (!itemId || itemId.trim().length === 0) {
          yield* Effect.fail(new InvalidInput({ reason: "itemId cannot be empty" }));
        }
        if (quantity < 0) {
          yield* Effect.fail(new InvalidInput({ reason: "quantity cannot be negative" }));
        }
        items.set(itemId, { total: quantity, reservations: new Map() });
      });

    const reserveImpl = (itemId: string, quantity: number): Effect.Effect<string, InvalidInput | ItemNotFound | InsufficientStock> =>
      Effect.gen(function* () {
        if (quantity < 0) {
          yield* Effect.fail(new InvalidInput({ reason: "quantity cannot be negative" }));
        }
        if (quantity === 0) {
          yield* Effect.fail(new InvalidInput({ reason: "quantity must be greater than zero" }));
        }

        const item = items.get(itemId);
        if (!item) {
          yield* Effect.fail(new ItemNotFound({ itemId }));
        }

        const reserved = Array.from(item!.reservations.values()).reduce((a, b) => a + b, 0);
        const available = item!.total - reserved;

        if (available < quantity) {
          yield* Effect.fail(
            new InsufficientStock({ itemId, requested: quantity, available })
          );
        }

        const reservationId = randomUUID();
        item!.reservations.set(reservationId, quantity);
        reservationMap.set(reservationId, { id: reservationId, itemId, quantity });

        return reservationId;
      });

    const releaseImpl = (reservationId: string): Effect.Effect<void, ReservationNotFound> =>
      Effect.gen(function* () {
        const reservation = reservationMap.get(reservationId);
        if (!reservation) {
          yield* Effect.fail(new ReservationNotFound({ reservationId }));
        }

        const item = items.get(reservation!.itemId);
        if (item) {
          item.reservations.delete(reservationId);
        }
        reservationMap.delete(reservationId);
      });

    const commitImpl = (reservationId: string): Effect.Effect<void, ReservationNotFound> =>
      Effect.gen(function* () {
        const reservation = reservationMap.get(reservationId);
        if (!reservation) {
          yield* Effect.fail(new ReservationNotFound({ reservationId }));
        }

        const item = items.get(reservation!.itemId);
        if (item) {
          item.total -= reservation!.quantity;
          item.reservations.delete(reservationId);
        }
        reservationMap.delete(reservationId);
      });

    const getAvailableImpl = (itemId: string): Effect.Effect<number, ItemNotFound> =>
      Effect.gen(function* () {
        const item = items.get(itemId);
        if (!item) {
          yield* Effect.fail(new ItemNotFound({ itemId }));
        }

        const reserved = Array.from(item!.reservations.values()).reduce((a, b) => a + b, 0);
        return item!.total - reserved;
      });

    const getReservedImpl = (itemId: string): Effect.Effect<number, ItemNotFound> =>
      Effect.gen(function* () {
        const item = items.get(itemId);
        if (!item) {
          yield* Effect.fail(new ItemNotFound({ itemId }));
        }

        return Array.from(item!.reservations.values()).reduce((a, b) => a + b, 0);
      });

    const getTotalImpl = (itemId: string): Effect.Effect<number, ItemNotFound> =>
      Effect.gen(function* () {
        const item = items.get(itemId);
        if (!item) {
          yield* Effect.fail(new ItemNotFound({ itemId }));
        }

        return item!.total;
      });

    return {
      addItem: (itemId: string, quantity: number) => {
        try {
          Effect.runSync(addItemImpl(itemId, quantity));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      reserve: (itemId: string, quantity: number) => {
        try {
          return Effect.runSync(reserveImpl(itemId, quantity));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      release: (reservationId: string) => {
        try {
          Effect.runSync(releaseImpl(reservationId));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      commit: (reservationId: string) => {
        try {
          Effect.runSync(commitImpl(reservationId));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      getAvailable: (itemId: string) => {
        try {
          return Effect.runSync(getAvailableImpl(itemId));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      getReserved: (itemId: string) => {
        try {
          return Effect.runSync(getReservedImpl(itemId));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
      getTotal: (itemId: string) => {
        try {
          return Effect.runSync(getTotalImpl(itemId));
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }
          throw new Error(String(e));
        }
      },
    };
  });
}

export function createInventory(): InventorySystemImpl {
  return Effect.runSync(createInventoryInternal());
}