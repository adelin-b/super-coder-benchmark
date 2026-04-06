import { Effect, Data, pipe } from "effect";

class InvalidQuantity extends Data.TaggedError("InvalidQuantity")<{
  reason: string;
}> {}
class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  sku: string;
  available: number;
  requested: number;
}> {}
class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  reservationId: string;
}> {}
class SkuNotFound extends Data.TaggedError("SkuNotFound")<{
  sku: string;
}> {}

interface StockRecord {
  total: number;
  available: number;
  reserved: Map<string, number>;
  committed: number;
}

interface InventoryState {
  stocks: Map<string, StockRecord>;
}

export interface Inventory {
  setStock(sku: string, quantity: number): void;
  getAvailable(sku: string): number;
  getReserved(sku: string): number;
  getCommitted(sku: string): number;
  reserve(sku: string, quantity: number): string;
  release(sku: string, reservationId: string): void;
  confirm(sku: string, reservationId: string): void;
}

function createInventoryInternal(): Effect.Effect<
  InventoryState,
  never,
  never
> {
  return Effect.succeed({
    stocks: new Map(),
  });
}

function setStockInternal(
  state: InventoryState,
  sku: string,
  quantity: number
): Effect.Effect<void, InvalidQuantity, never> {
  return Effect.gen(function* () {
    if (quantity <= 0) {
      yield* Effect.fail(
        new InvalidQuantity({ reason: "quantity must be positive" })
      );
    }
    const record: StockRecord = {
      total: quantity,
      available: quantity,
      reserved: new Map(),
      committed: 0,
    };
    state.stocks.set(sku, record);
  });
}

function getAvailableInternal(
  state: InventoryState,
  sku: string
): Effect.Effect<number, SkuNotFound, never> {
  return Effect.gen(function* () {
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    return record!.available;
  });
}

function getReservedInternal(
  state: InventoryState,
  sku: string
): Effect.Effect<number, SkuNotFound, never> {
  return Effect.gen(function* () {
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    let total = 0;
    for (const qty of record!.reserved.values()) {
      total += qty;
    }
    return total;
  });
}

function getCommittedInternal(
  state: InventoryState,
  sku: string
): Effect.Effect<number, SkuNotFound, never> {
  return Effect.gen(function* () {
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    return record!.committed;
  });
}

function reserveInternal(
  state: InventoryState,
  sku: string,
  quantity: number
): Effect.Effect<string, InvalidQuantity | InsufficientStock | SkuNotFound, never> {
  return Effect.gen(function* () {
    if (quantity <= 0) {
      yield* Effect.fail(
        new InvalidQuantity({ reason: "quantity must be positive" })
      );
    }
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    if (record!.available < quantity) {
      yield* Effect.fail(
        new InsufficientStock({
          sku,
          available: record!.available,
          requested: quantity,
        })
      );
    }
    const reservationId = `RES-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    record!.available -= quantity;
    record!.reserved.set(reservationId, quantity);
    return reservationId;
  });
}

function releaseInternal(
  state: InventoryState,
  sku: string,
  reservationId: string
): Effect.Effect<void, SkuNotFound | ReservationNotFound, never> {
  return Effect.gen(function* () {
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    const quantity = record!.reserved.get(reservationId);
    if (quantity === undefined) {
      yield* Effect.fail(new ReservationNotFound({ reservationId }));
    }
    record!.reserved.delete(reservationId);
    record!.available += quantity!;
  });
}

function confirmInternal(
  state: InventoryState,
  sku: string,
  reservationId: string
): Effect.Effect<void, SkuNotFound | ReservationNotFound, never> {
  return Effect.gen(function* () {
    const record = state.stocks.get(sku);
    if (!record) {
      yield* Effect.fail(new SkuNotFound({ sku }));
    }
    const quantity = record!.reserved.get(reservationId);
    if (quantity === undefined) {
      yield* Effect.fail(new ReservationNotFound({ reservationId }));
    }
    record!.reserved.delete(reservationId);
    record!.committed += quantity!;
  });
}

export function createInventory(): Inventory {
  let state: InventoryState | null = null;

  try {
    state = Effect.runSync(createInventoryInternal());
  } catch (e: unknown) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }

  if (!state) throw new Error("Failed to initialize inventory state");

  return {
    setStock(sku: string, quantity: number): void {
      try {
        Effect.runSync(setStockInternal(state!, sku, quantity));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    getAvailable(sku: string): number {
      try {
        return Effect.runSync(getAvailableInternal(state!, sku));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    getReserved(sku: string): number {
      try {
        return Effect.runSync(getReservedInternal(state!, sku));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    getCommitted(sku: string): number {
      try {
        return Effect.runSync(getCommittedInternal(state!, sku));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    reserve(sku: string, quantity: number): string {
      try {
        return Effect.runSync(reserveInternal(state!, sku, quantity));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    release(sku: string, reservationId: string): void {
      try {
        Effect.runSync(releaseInternal(state!, sku, reservationId));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },

    confirm(sku: string, reservationId: string): void {
      try {
        Effect.runSync(confirmInternal(state!, sku, reservationId));
      } catch (e: unknown) {
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      }
    },
  };
}