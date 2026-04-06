export class InventoryReservationSystem {
  private items: Map<string, { available: number; reserved: number }> = new Map();

  addItem(itemId: string, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Quantity must be a non-negative integer");
    }
    this.items.set(itemId, { available: quantity, reserved: 0 });
  }

  reserve(itemId: string, quantity: number): string {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (!item) throw new Error("Item not found");
    if (item.available < quantity) throw new Error("Insufficient available stock");

    item.available -= quantity;
    item.reserved += quantity;

    return `${itemId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  }

  release(itemId: string, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (!item) throw new Error("Item not found");
    if (item.reserved < quantity) throw new Error("Cannot release more than reserved");

    item.available += quantity;
    item.reserved -= quantity;
  }

  checkAvailability(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error("Item not found");
    return item.available;
  }

  getReserved(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error("Item not found");
    return item.reserved;
  }

  getTotal(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) throw new Error("Item not found");
    return item.available + item.reserved;
  }

  removeItem(itemId: string): void {
    if (!this.items.has(itemId)) throw new Error("Item not found");
    this.items.delete(itemId);
  }
}