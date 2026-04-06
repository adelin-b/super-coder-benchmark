import { Effect, Ref, pipe, Data } from "effect";
import { crypto } from "node:crypto";

// Internal: Error types
class InsufficientStock extends Data.TaggedError("InsufficientStock")<{
  productId: string;
  requested: number;
  available: number;
}> {}

class ProductNotFound extends Data.TaggedError("ProductNotFound")<{
  productId: string;
}> {}

class ReservationNotFound extends Data.TaggedError("ReservationNotFound")<{
  reservationId: string;
}> {}

// Public: Types
export interface Inventory {
  productId: string;
  total: number;
  reserved: number;
  available: number;
}

export interface ReservationRecord {
  reservationId: string;
  productId: string;
  quantity: number;
}

// Internal: State
interface ProductState {
  productId: string;
  total: number;
  reservations: Map<string, number>;
}

type InventoryState = Map<string, ProductState>;

// Public: Manager
export class InventoryManager {
  private stateRef: Ref.Ref<InventoryState>;

  constructor(stateRef: Ref.Ref<InventoryState>) {
    this.stateRef = stateRef;
  }
}

// Internal: Effect-based operations
const addStockEffect = (
  manager: InventoryManager,
  productId: string,
  quantity: number
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (quantity <= 0) {
      yield* Effect.fail(new Error("Quantity must be positive"));
    }
    const state = yield* Ref.get(manager["stateRef"]);
    const product = state.get(productId);
    if (product) {
      product.total += quantity;
    } else {
      state.set(productId, {
        productId,
        total: quantity,
        reservations: new Map(),
      });
    }
  });

const reserveEffect = (
  manager: InventoryManager,
  productId: string,
  quantity: number
): Effect.Effect<string, InsufficientStock | ProductNotFound> =>
  Effect.gen(function* () {
    if (quantity <= 0) {
      yield* Effect.fail(new Error("Quantity must be positive"));
    }
    const state = yield* Ref.get(manager["stateRef"]);
    const product = state.get(productId);
    if (!product) {
      yield* Effect.fail(new ProductNotFound({ productId }));
    }
    const reserved = Array.from(product.reservations.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );
    const available = product.total - reserved;
    if (available < quantity) {
      yield* Effect.fail(
        new InsufficientStock({
          productId,
          requested: quantity,
          available,
        })
      );
    }
    const reservationId = crypto.randomUUID();
    product.reservations.set(reservationId, quantity);
    return reservationId;
  });

const releaseEffect = (
  manager: InventoryManager,
  reservationId: string
): Effect.Effect<void, ReservationNotFound> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(manager["stateRef"]);
    let found = false;
    for (const product of state.values()) {
      if (product.reservations.has(reservationId)) {
        product.reservations.delete(reservationId);
        found = true;
        break;
      }
    }
    if (!found) {
      yield* Effect.fail(new ReservationNotFound({ reservationId }));
    }
  });

const getAvailableEffect = (
  manager: InventoryManager,
  productId: string
): Effect.Effect<number, ProductNotFound> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(manager["stateRef"]);
    const product = state.get(productId);
    if (!product) {
      yield* Effect.fail(new ProductNotFound({ productId }));
    }
    const reserved = Array.from(product.reservations.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );
    return product.total - reserved;
  });

const getInventoryEffect = (
  manager: InventoryManager,
  productId: string
): Effect.Effect<Inventory, ProductNotFound> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(manager["stateRef"]);
    const product = state.get(productId);
    if (!product) {
      yield* Effect.fail(new ProductNotFound({ productId }));
    }
    const reserved = Array.from(product.reservations.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );
    const available = product.total - reserved;
    return {
      productId: product.productId,
      total: product.total,
      reserved,
      available,
    };
  });

// Public: Creation
export function createInventory(): InventoryManager {
  const stateRef = Effect.runSync(Ref.make(new Map<string, ProductState>()));
  return new InventoryManager(stateRef);
}

// Public: Operations
export function addStock(
  manager: InventoryManager,
  productId: string,
  quantity: number
): void {
  if (!productId || productId.trim() === "") {
    throw new Error("productId is required");
  }
  if (typeof quantity !== "number" || quantity <= 0) {
    throw new Error("quantity must be a positive number");
  }
  try {
    Effect.runSync(addStockEffect(manager, productId, quantity));
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

export function reserve(
  manager: InventoryManager,
  productId: string,
  quantity: number
): ReservationRecord {
  if (!productId || productId.trim() === "") {
    throw new Error("productId is required");
  }
  if (typeof quantity !== "number" || quantity <= 0) {
    throw new Error("quantity must be a positive number");
  }
  try {
    const reservationId = Effect.runSync(
      reserveEffect(manager, productId, quantity)
    );
    return {
      reservationId,
      productId,
      quantity,
    };
  } catch (e) {
    if (e instanceof InsufficientStock) {
      throw new Error(
        `Insufficient stock for ${e.productId}: requested ${e.requested}, available ${e.available}`
      );
    }
    if (e instanceof ProductNotFound) {
      throw new Error(`Product not found: ${e.productId}`);
    }
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

export function release(
  manager: InventoryManager,
  reservationId: string
): void {
  if (!reservationId || reservationId.trim() === "") {
    throw new Error("reservationId is required");
  }
  try {
    Effect.runSync(releaseEffect(manager, reservationId));
  } catch (e) {
    if (e instanceof ReservationNotFound) {
      throw new Error(`Reservation not found: ${e.reservationId}`);
    }
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

export function getAvailable(
  manager: InventoryManager,
  productId: string
): number {
  if (!productId || productId.trim() === "") {
    throw new Error("productId is required");
  }
  try {
    return Effect.runSync(getAvailableEffect(manager, productId));
  } catch (e) {
    if (e instanceof ProductNotFound) {
      throw new Error(`Product not found: ${e.productId}`);
    }
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

export function getInventory(
  manager: InventoryManager,
  productId: string
): Inventory {
  if (!productId || productId.trim() === "") {
    throw new Error("productId is required");
  }
  try {
    return Effect.runSync(getInventoryEffect(manager, productId));
  } catch (e) {
    if (e instanceof ProductNotFound) {
      throw new Error(`Product not found: ${e.productId}`);
    }
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}