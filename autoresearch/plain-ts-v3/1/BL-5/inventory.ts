export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityError';
  }
}

export class ItemNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemNotFoundError';
  }
}

interface InventoryItem {
  available: number;
  reserved: number;
}

export interface Inventory {
  reserve(itemId: string, quantity: number): void;
  release(itemId: string, quantity: number): void;
  getAvailable(itemId: string): number;
  getReserved(itemId: string): number;
  getTotal(itemId: string): number;
}

export function createInventory(initialStock?: Record<string, number>): Inventory {
  const items = new Map<string, InventoryItem>();

  if (initialStock) {
    for (const [itemId, quantity] of Object.entries(initialStock)) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new InvalidQuantityError(
          `Invalid initial stock quantity for item ${itemId}: ${quantity}`
        );
      }
      items.set(itemId, { available: quantity, reserved: 0 });
    }
  }

  return {
    reserve(itemId: string, quantity: number): void {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new InvalidQuantityError(
          `Invalid reservation quantity: ${quantity}`
        );
      }

      if (!items.has(itemId)) {
        items.set(itemId, { available: 0, reserved: 0 });
      }

      const item = items.get(itemId)!;
      if (item.available < quantity) {
        throw new InsufficientStockError(
          `Insufficient stock for item ${itemId}: available=${item.available}, requested=${quantity}`
        );
      }

      item.available -= quantity;
      item.reserved += quantity;
    },

    release(itemId: string, quantity: number): void {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new InvalidQuantityError(
          `Invalid release quantity: ${quantity}`
        );
      }

      if (!items.has(itemId)) {
        throw new ItemNotFoundError(`Item not found: ${itemId}`);
      }

      const item = items.get(itemId)!;
      if (item.reserved < quantity) {
        throw new InsufficientStockError(
          `Cannot release more than reserved: item=${itemId}, reserved=${item.reserved}, requested=${quantity}`
        );
      }

      item.available += quantity;
      item.reserved -= quantity;
    },

    getAvailable(itemId: string): number {
      if (!items.has(itemId)) {
        throw new ItemNotFoundError(`Item not found: ${itemId}`);
      }
      return items.get(itemId)!.available;
    },

    getReserved(itemId: string): number {
      if (!items.has(itemId)) {
        throw new ItemNotFoundError(`Item not found: ${itemId}`);
      }
      return items.get(itemId)!.reserved;
    },

    getTotal(itemId: string): number {
      if (!items.has(itemId)) {
        throw new ItemNotFoundError(`Item not found: ${itemId}`);
      }
      const item = items.get(itemId)!;
      return item.available + item.reserved;
    },
  };
}