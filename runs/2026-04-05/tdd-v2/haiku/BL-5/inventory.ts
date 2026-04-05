export interface InventoryItem {
  itemId: string;
  total: number;
  reserved: number;
}

export class InventoryReservationSystem {
  private inventory: Map<string, InventoryItem> = new Map();
  private locks: Map<string, Promise<void>> = new Map();

  private async acquireLock(itemId: string): Promise<() => void> {
    while (this.locks.has(itemId)) {
      await this.locks.get(itemId);
    }

    let releaseLock: (() => void) | undefined;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(itemId, lockPromise);
    return () => {
      this.locks.delete(itemId);
      releaseLock?.();
    };
  }

  addItem(itemId: string, quantity: number): void {
    if (!this.inventory.has(itemId)) {
      this.inventory.set(itemId, {
        itemId,
        total: quantity,
        reserved: 0,
      });
    } else {
      const item = this.inventory.get(itemId)!;
      item.total += quantity;
    }
  }

  async reserve(itemId: string, quantity: number): Promise<boolean> {
    const release = await this.acquireLock(itemId);
    try {
      const item = this.inventory.get(itemId);
      if (!item) return false;

      const available = item.total - item.reserved;
      if (available < quantity) return false;

      item.reserved += quantity;
      return true;
    } finally {
      release();
    }
  }

  async release(itemId: string, quantity: number): Promise<boolean> {
    const release = await this.acquireLock(itemId);
    try {
      const item = this.inventory.get(itemId);
      if (!item) return false;

      if (item.reserved < quantity) return false;

      item.reserved -= quantity;
      return true;
    } finally {
      release();
    }
  }

  getAvailability(itemId: string): number {
    const item = this.inventory.get(itemId);
    if (!item) return 0;
    return item.total - item.reserved;
  }

  getInventoryItem(itemId: string): InventoryItem | undefined {
    return this.inventory.get(itemId);
  }
}