export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  message?: string;
}

export interface InventoryItem {
  total: number;
  reserved: number;
}

export class InventoryManager {
  private items: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, { itemId: string; quantity: number }> =
    new Map();
  private reservationCounter: number = 0;
  private lockQueue: Map<string, Promise<void>> = new Map();

  constructor() {}

  /**
   * Initialize inventory for an item
   */
  initializeItem(itemId: string, quantity: number): void {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Quantity must be a non-negative integer");
    }
    this.items.set(itemId, { total: quantity, reserved: 0 });
  }

  /**
   * Reserve stock for an item
   */
  reserve(itemId: string, quantity: number): ReservationResult {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }

    const available = item.total - item.reserved;
    if (available < quantity) {
      return {
        success: false,
        message: `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
      };
    }

    item.reserved += quantity;
    const reservationId = `RES-${itemId}-${++this.reservationCounter}`;
    this.reservations.set(reservationId, { itemId, quantity });

    return {
      success: true,
      reservationId,
    };
  }

  /**
   * Release a reservation
   */
  release(reservationId: string): ReservationResult {
    if (typeof reservationId !== "string" || reservationId.length === 0) {
      throw new Error("Invalid reservation ID");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return {
        success: false,
        message: `Reservation ${reservationId} not found`,
      };
    }

    const item = this.items.get(reservation.itemId);
    if (!item) {
      throw new Error(`Item ${reservation.itemId} not found in inventory`);
    }

    item.reserved = Math.max(0, item.reserved - reservation.quantity);
    this.reservations.delete(reservationId);

    return {
      success: true,
    };
  }

  /**
   * Check available quantity for an item
   */
  getAvailable(itemId: string): number {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }

    return item.total - item.reserved;
  }

  /**
   * Get total stock for an item
   */
  getTotal(itemId: string): number {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }

    return item.total;
  }

  /**
   * Get reserved quantity for an item
   */
  getReserved(itemId: string): number {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }

    return item.reserved;
  }

  /**
   * Commit a reservation (deduct from total stock)
   */
  commit(reservationId: string): ReservationResult {
    if (typeof reservationId !== "string" || reservationId.length === 0) {
      throw new Error("Invalid reservation ID");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return {
        success: false,
        message: `Reservation ${reservationId} not found`,
      };
    }

    const item = this.items.get(reservation.itemId);
    if (!item) {
      throw new Error(`Item ${reservation.itemId} not found in inventory`);
    }

    item.total = Math.max(0, item.total - reservation.quantity);
    item.reserved = Math.max(0, item.reserved - reservation.quantity);
    this.reservations.delete(reservationId);

    return {
      success: true,
    };
  }

  /**
   * Add stock to an item
   */
  addStock(itemId: string, quantity: number): void {
    if (typeof itemId !== "string" || itemId.length === 0) {
      throw new Error("Invalid item ID");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in inventory`);
    }

    item.total += quantity;
  }

  /**
   * Check if item exists
   */
  hasItem(itemId: string): boolean {
    if (typeof itemId !== "string") {
      throw new Error("Invalid item ID");
    }
    return this.items.has(itemId);
  }

  /**
   * Get all items and their status
   */
  getAllItems(): Record<string, InventoryItem> {
    const result: Record<string, InventoryItem> = {};
    this.items.forEach((value, key) => {
      result[key] = { total: value.total, reserved: value.reserved };
    });
    return result;
  }

  /**
   * Clear all inventory and reservations
   */
  clear(): void {
    this.items.clear();
    this.reservations.clear();
    this.reservationCounter = 0;
  }
}

export function createInventoryManager(): InventoryManager {
  return new InventoryManager();
}