export interface InventoryItem {
  id: string;
  quantity: number;
  reserved: number;
}

export class InventoryManager {
  private items: Map<string, InventoryItem>;
  private locks: Map<string, Promise<void>>;

  constructor() {
    this.items = new Map();
    this.locks = new Map();
  }

  private async acquireLock(itemId: string): Promise<() => void> {
    while (this.locks.has(itemId)) {
      await this.locks.get(itemId);
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(itemId, lockPromise);

    return () => {
      releaseLock!();
      this.locks.delete(itemId);
    };
  }

  addItem(itemId: string, quantity: number): void {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    this.items.set(itemId, {
      id: itemId,
      quantity,
      reserved: 0,
    });
  }

  async reserve(itemId: string, quantity: number): Promise<boolean> {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const release = await this.acquireLock(itemId);

    try {
      const item = this.items.get(itemId);
      if (!item) {
        return false;
      }

      const available = item.quantity - item.reserved;
      if (available >= quantity) {
        item.reserved += quantity;
        return true;
      }
      return false;
    } finally {
      release();
    }
  }

  async release(itemId: string, quantity: number): Promise<boolean> {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const release = await this.acquireLock(itemId);

    try {
      const item = this.items.get(itemId);
      if (!item) {
        return false;
      }

      if (item.reserved >= quantity) {
        item.reserved -= quantity;
        return true;
      }
      return false;
    } finally {
      release();
    }
  }

  checkAvailability(itemId: string, quantity: number): boolean {
    const item = this.items.get(itemId);
    if (!item) {
      return false;
    }

    return item.quantity - item.reserved >= quantity;
  }

  getItem(itemId: string): InventoryItem | undefined {
    const item = this.items.get(itemId);
    if (!item) {
      return undefined;
    }
    return { ...item };
  }
}

export function createInventoryManager(): InventoryManager {
  return new InventoryManager();
}