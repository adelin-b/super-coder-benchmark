import { Effect, pipe } from "effect";
import { v4 as uuidv4 } from "uuid";

// Error types
class InsufficientStockError extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = "ProductNotFoundError";
  }
}

class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

// Types
interface Reservation {
  id: string;
  productId: string;
  quantity: number;
  createdAt: Date;
}

interface InventoryItem {
  productId: string;
  total: number;
  reserved: number;
}

interface InventoryStatus {
  productId: string;
  total: number;
  reserved: number;
  available: number;
}

// Internal Effect-based implementation
class InventoryManager {
  private inventory: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();

  private addProductEffect = (
    productId: string,
    quantity: number
  ): Effect.Effect<void, Error> => {
    return Effect.gen(function* () {
      if (this.inventory.has(productId)) {
        yield* Effect.fail(new Error(`Product already exists: ${productId}`));
      }
      this.inventory.set(productId, {
        productId,
        total: quantity,
        reserved: 0,
      });
    });
  };

  private reserveEffect = (
    productId: string,
    quantity: number
  ): Effect.Effect<string, InsufficientStockError | ProductNotFoundError> => {
    return Effect.gen(function* () {
      const item = this.inventory.get(productId);
      if (!item) {
        yield* Effect.fail(new ProductNotFoundError(productId));
      }

      const available = item!.total - item!.reserved;
      if (quantity > available) {
        yield* Effect.fail(
          new InsufficientStockError(productId, quantity, available)
        );
      }

      const reservationId = uuidv4();
      const reservation: Reservation = {
        id: reservationId,
        productId,
        quantity,
        createdAt: new Date(),
      };

      this.reservations.set(reservationId, reservation);
      item!.reserved += quantity;

      return reservationId;
    });
  };

  private releaseEffect = (
    reservationId: string
  ): Effect.Effect<void, ReservationNotFoundError> => {
    return Effect.gen(function* () {
      const reservation = this.reservations.get(reservationId);
      if (!reservation) {
        yield* Effect.fail(new ReservationNotFoundError(reservationId));
      }

      const item = this.inventory.get(reservation!.productId);
      if (item) {
        item.reserved -= reservation!.quantity;
      }

      this.reservations.delete(reservationId);
    });
  };

  private checkAvailabilityEffect = (
    productId: string
  ): Effect.Effect<number, ProductNotFoundError> => {
    return Effect.gen(function* () {
      const item = this.inventory.get(productId);
      if (!item) {
        yield* Effect.fail(new ProductNotFoundError(productId));
      }

      return item!.total - item!.reserved;
    });
  };

  private getStatusEffect = (
    productId: string
  ): Effect.Effect<InventoryStatus, ProductNotFoundError> => {
    return Effect.gen(function* () {
      const item = this.inventory.get(productId);
      if (!item) {
        yield* Effect.fail(new ProductNotFoundError(productId));
      }

      return {
        productId: item!.productId,
        total: item!.total,
        reserved: item!.reserved,
        available: item!.total - item!.reserved,
      };
    });
  };

  addProduct = (productId: string, quantity: number): void => {
    Effect.runSync(this.addProductEffect(productId, quantity));
  };

  reserve = (productId: string, quantity: number): string => {
    return Effect.runSync(this.reserveEffect(productId, quantity));
  };

  release = (reservationId: string): void => {
    Effect.runSync(this.releaseEffect(reservationId));
  };

  checkAvailability = (productId: string): number => {
    return Effect.runSync(this.checkAvailabilityEffect(productId));
  };

  getStatus = (productId: string): InventoryStatus => {
    return Effect.runSync(this.getStatusEffect(productId));
  };
}

// EXPORTED: Plain TypeScript API
export class InventorySystem {
  private manager: InventoryManager;

  constructor() {
    this.manager = new InventoryManager();
  }

  addProduct(productId: string, quantity: number): void {
    this.manager.addProduct(productId, quantity);
  }

  reserve(productId: string, quantity: number): string {
    return this.manager.reserve(productId, quantity);
  }

  release(reservationId: string): void {
    this.manager.release(reservationId);
  }

  checkAvailability(productId: string): number {
    return this.manager.checkAvailability(productId);
  }

  getStatus(productId: string): InventoryStatus {
    return this.manager.getStatus(productId);
  }
}

export {
  InsufficientStockError,
  ProductNotFoundError,
  ReservationNotFoundError,
  Reservation,
  InventoryItem,
  InventoryStatus,
};