interface ReservationItem {
  itemId: string;
  totalStock: number;
  reserved: number;
}

class InventoryReservationSystem {
  private inventory: Map<string, ReservationItem>;

  constructor() {
    this.inventory = new Map();
  }

  addItem(itemId: string, quantity: number): void {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    if (this.inventory.has(itemId)) {
      throw new Error(`Item ${itemId} already exists`);
    }
    this.inventory.set(itemId, {
      itemId,
      totalStock: quantity,
      reserved: 0,
    });
  }

  reserve(itemId: string, quantity: number): void {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    const available = item.totalStock - item.reserved;
    if (quantity > available) {
      throw new Error(
        `Insufficient stock for item ${itemId}. Available: ${available}, Requested: ${quantity}`
      );
    }
    item.reserved += quantity;
  }

  release(itemId: string, quantity: number): void {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    if (quantity > item.reserved) {
      throw new Error(
        `Cannot release more than reserved for item ${itemId}. Reserved: ${item.reserved}, Requested: ${quantity}`
      );
    }
    item.reserved -= quantity;
  }

  getAvailable(itemId: string): number {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.totalStock - item.reserved;
  }

  getTotalStock(itemId: string): number {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.totalStock;
  }

  getReserved(itemId: string): number {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.reserved;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.has(itemId);
  }

  removeItem(itemId: string): void {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    if (item.reserved > 0) {
      throw new Error(
        `Cannot remove item ${itemId} with active reservations`
      );
    }
    this.inventory.delete(itemId);
  }
}

export { InventoryReservationSystem };