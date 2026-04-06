interface InventoryItem {
  id: string;
  total: number;
  reserved: number;
}

interface ReservationResult {
  success: boolean;
  available: number;
}

class InventoryManager {
  private items: Map<string, InventoryItem> = new Map();
  private operationQueue: Array<() => void> = [];
  private isProcessing: boolean = false;

  addItem(id: string, total: number): void {
    if (typeof total !== 'number' || total < 0 || !Number.isFinite(total)) {
      throw new Error('Invalid total: must be a non-negative number');
    }
    if (this.items.has(id)) {
      throw new Error(`Item ${id} already exists`);
    }
    this.items.set(id, { id, total, reserved: 0 });
  }

  reserve(itemId: string, quantity: number): ReservationResult {
    if (typeof quantity !== 'number' || quantity < 0 || !Number.isFinite(quantity)) {
      throw new Error('Invalid quantity: must be a non-negative number');
    }
    if (!Number.isInteger(quantity)) {
      throw new Error('Quantity must be an integer');
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    const available = item.total - item.reserved;
    if (quantity > available) {
      return { success: false, available };
    }

    item.reserved += quantity;
    return { success: true, available: item.total - item.reserved };
  }

  release(itemId: string, quantity: number): number {
    if (typeof quantity !== 'number' || quantity < 0 || !Number.isFinite(quantity)) {
      throw new Error('Invalid quantity: must be a non-negative number');
    }
    if (!Number.isInteger(quantity)) {
      throw new Error('Quantity must be an integer');
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    if (quantity > item.reserved) {
      throw new Error(`Cannot release ${quantity}: only ${item.reserved} reserved`);
    }

    item.reserved -= quantity;
    return item.total - item.reserved;
  }

  available(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.total - item.reserved;
  }

  getReserved(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.reserved;
  }

  getTotal(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.total;
  }

  getItem(itemId: string): InventoryItem | undefined {
    return this.items.get(itemId);
  }

  async executeOperation(operation: () => void): Promise<void> {
    this.operationQueue.push(operation);
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        operation();
      }
    }

    this.isProcessing = false;
  }

  removeItem(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  clear(): void {
    this.items.clear();
    this.operationQueue = [];
  }
}

export { InventoryManager, InventoryItem, ReservationResult };