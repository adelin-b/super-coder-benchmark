export class InventoryReservationSystem {
  private stock: Map<string, number> = new Map();
  private reservations: Map<string, { itemId: string; quantity: number }> = new Map();
  private reservationCounter = 0;

  addStock(itemId: string, quantity: number): void {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    const current = this.stock.get(itemId) || 0;
    this.stock.set(itemId, current + quantity);
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    const available = this.getAvailable(itemId);
    if (available < quantity) {
      throw new Error('Insufficient stock for reservation');
    }
    
    const reservationId = `RES-${++this.reservationCounter}`;
    this.reservations.set(reservationId, { itemId, quantity });
    return reservationId;
  }

  release(reservationId: string): void {
    if (!this.reservations.has(reservationId)) {
      throw new Error('Reservation not found');
    }
    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string, quantity: number): boolean {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    return this.getAvailable(itemId) >= quantity;
  }

  getAvailable(itemId: string): number {
    const total = this.stock.get(itemId) || 0;
    let reserved = 0;
    for (const res of this.reservations.values()) {
      if (res.itemId === itemId) {
        reserved += res.quantity;
      }
    }
    return Math.max(0, total - reserved);
  }

  getStock(itemId: string): number {
    return this.stock.get(itemId) || 0;
  }

  getReservedQuantity(itemId: string): number {
    let reserved = 0;
    for (const res of this.reservations.values()) {
      if (res.itemId === itemId) {
        reserved += res.quantity;
      }
    }
    return reserved;
  }
}

export function createInventory(): InventoryReservationSystem {
  return new InventoryReservationSystem();
}