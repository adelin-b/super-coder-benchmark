export class InventoryReservationSystem {
  private inventory: Map<string, number> = new Map();
  private reservations: Map<string, { itemId: string; quantity: number }> = new Map();

  constructor(initialInventory?: Record<string, number>) {
    if (initialInventory) {
      for (const [itemId, quantity] of Object.entries(initialInventory)) {
        if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
          throw new Error(`Invalid initial quantity for ${itemId}`);
        }
        this.inventory.set(itemId, quantity);
      }
    }
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    const available = this.checkAvailability(itemId);
    if (available < quantity) {
      throw new Error(
        `Insufficient inventory for ${itemId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.reservations.set(reservationId, { itemId, quantity });
    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId || typeof reservationId !== 'string') {
      throw new Error('Reservation ID must be a non-empty string');
    }
    if (!this.reservations.has(reservationId)) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string): number {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }

    const total = this.inventory.get(itemId) ?? 0;
    const reserved = Array.from(this.reservations.values())
      .filter((r) => r.itemId === itemId)
      .reduce((sum, r) => sum + r.quantity, 0);

    return total - reserved;
  }

  addStock(itemId: string, quantity: number): void {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    const current = this.inventory.get(itemId) ?? 0;
    this.inventory.set(itemId, current + quantity);
  }

  getTotalStock(itemId: string): number {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    return this.inventory.get(itemId) ?? 0;
  }

  getReservedQuantity(itemId: string): number {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }

    return Array.from(this.reservations.values())
      .filter((r) => r.itemId === itemId)
      .reduce((sum, r) => sum + r.quantity, 0);
  }
}