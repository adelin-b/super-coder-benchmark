interface InventoryItem {
  available: number;
  reserved: number;
}

interface ReservationStatus {
  available: number;
  reserved: number;
  total: number;
}

export class InventoryReservationSystem {
  private inventory: Map<string, InventoryItem> = new Map();

  /**
   * Add stock to an item. Creates the item if it doesn't exist.
   */
  addStock(itemId: string, quantity: number): void {
    if (quantity <= 0) return;
    
    const item = this.inventory.get(itemId) || { available: 0, reserved: 0 };
    item.available += quantity;
    this.inventory.set(itemId, item);
  }

  /**
   * Reserve stock. Returns true if reservation succeeded, false otherwise.
   * Succeeds only if sufficient available stock exists.
   */
  reserve(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    
    const item = this.inventory.get(itemId);
    if (!item || item.available < quantity) return false;
    
    item.available -= quantity;
    item.reserved += quantity;
    return true;
  }

  /**
   * Release reserved stock back to available. Returns true if successful.
   */
  release(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return false;
    
    const item = this.inventory.get(itemId);
    if (!item || item.reserved < quantity) return false;
    
    item.reserved -= quantity;
    item.available += quantity;
    return true;
  }

  /**
   * Check if enough available stock exists for a reservation.
   */
  isAvailable(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return true;
    
    const item = this.inventory.get(itemId);
    return item ? item.available >= quantity : false;
  }

  /**
   * Get the current status of an item's inventory.
   */
  getStatus(itemId: string): ReservationStatus | null {
    const item = this.inventory.get(itemId);
    if (!item) return null;
    
    return {
      available: item.available,
      reserved: item.reserved,
      total: item.available + item.reserved,
    };
  }

  /**
   * Get all item IDs in the inventory.
   */
  listItems(): string[] {
    return Array.from(this.inventory.keys());
  }

  /**
   * Clear all inventory data.
   */
  clear(): void {
    this.inventory.clear();
  }

  /**
   * Get available quantity for an item. Returns 0 if item doesn't exist.
   */
  getAvailableQuantity(itemId: string): number {
    return this.inventory.get(itemId)?.available ?? 0;
  }

  /**
   * Get reserved quantity for an item. Returns 0 if item doesn't exist.
   */
  getReservedQuantity(itemId: string): number {
    return this.inventory.get(itemId)?.reserved ?? 0;
  }

  /**
   * Get total stock (available + reserved) for an item. Returns 0 if item doesn't exist.
   */
  getTotalQuantity(itemId: string): number {
    const item = this.inventory.get(itemId);
    return item ? item.available + item.reserved : 0;
  }
}

export type { InventoryItem, ReservationStatus };