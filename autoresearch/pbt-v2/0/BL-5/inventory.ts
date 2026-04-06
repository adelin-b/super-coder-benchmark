export interface InventoryItem {
  id: string;
  name: string;
  totalStock: number;
  reserved: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: Date;
}

export class InventoryReservationSystem {
  private items: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reservationCounter: number = 0;

  addItem(id: string, name: string, totalStock: number): void {
    if (this.items.has(id)) {
      throw new Error(`Item with id ${id} already exists`);
    }
    if (totalStock < 0) {
      throw new Error("Total stock cannot be negative");
    }
    this.items.set(id, {
      id,
      name,
      totalStock,
      reserved: 0,
    });
  }

  reserve(itemId: string, quantity: number): string {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item with id ${itemId} not found`);
    }
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }
    const available = item.totalStock - item.reserved;
    if (available < quantity) {
      throw new Error(
        `Insufficient stock: requested ${quantity}, available ${available}`
      );
    }
    item.reserved += quantity;
    const reservationId = `RES-${++this.reservationCounter}`;
    this.reservations.set(reservationId, {
      id: reservationId,
      itemId,
      quantity,
      timestamp: new Date(),
    });
    return reservationId;
  }

  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation with id ${reservationId} not found`);
    }
    const item = this.items.get(reservation.itemId);
    if (!item) {
      throw new Error(`Item with id ${reservation.itemId} not found`);
    }
    item.reserved -= reservation.quantity;
    this.reservations.delete(reservationId);
  }

  getAvailability(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item with id ${itemId} not found`);
    }
    return item.totalStock - item.reserved;
  }

  getItem(itemId: string): InventoryItem | undefined {
    return this.items.get(itemId);
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  async reserveAsync(itemId: string, quantity: number): Promise<string> {
    return Promise.resolve(this.reserve(itemId, quantity));
  }

  async releaseAsync(reservationId: string): Promise<void> {
    return Promise.resolve(this.release(reservationId));
  }

  async getAvailabilityAsync(itemId: string): Promise<number> {
    return Promise.resolve(this.getAvailability(itemId));
  }
}