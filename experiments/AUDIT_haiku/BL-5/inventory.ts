interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

interface InventoryItem {
  id: string;
  totalQuantity: number;
  reservedQuantity: number;
}

class InventoryReservationSystem {
  private inventory: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reservationCounter: number = 0;
  private locks: Map<string, Promise<void>> = new Map();

  addItem(itemId: string, quantity: number): void {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    this.inventory.set(itemId, {
      id: itemId,
      totalQuantity: quantity,
      reservedQuantity: 0
    });
  }

  private async acquireLock(itemId: string): Promise<void> {
    let resolve: () => void;
    const promise = new Promise<void>(r => (resolve = r));
    const currentLock = this.locks.get(itemId) || Promise.resolve();
    this.locks.set(itemId, currentLock.then(() => promise));
    await currentLock;
    return promise.then(() => {}).then(() => resolve());
  }

  async reserve(itemId: string, quantity: number): Promise<string> {
    await this.acquireLock(itemId);

    try {
      const item = this.inventory.get(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      const available = item.totalQuantity - item.reservedQuantity;
      if (available < quantity) {
        throw new Error(
          `Insufficient stock for ${itemId}. Available: ${available}, Requested: ${quantity}`
        );
      }

      const reservationId = `RES-${++this.reservationCounter}`;
      item.reservedQuantity += quantity;

      const reservation: Reservation = {
        id: reservationId,
        itemId,
        quantity,
        timestamp: Date.now()
      };

      this.reservations.set(reservationId, reservation);
      return reservationId;
    } finally {
      const lock = this.locks.get(itemId);
      if (lock) {
        this.locks.delete(itemId);
      }
    }
  }

  async release(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    await this.acquireLock(reservation.itemId);

    try {
      const item = this.inventory.get(reservation.itemId);
      if (item) {
        item.reservedQuantity = Math.max(
          0,
          item.reservedQuantity - reservation.quantity
        );
      }

      this.reservations.delete(reservationId);
    } finally {
      const lock = this.locks.get(reservation.itemId);
      if (lock) {
        this.locks.delete(reservation.itemId);
      }
    }
  }

  async getAvailability(itemId: string): Promise<number> {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    return item.totalQuantity - item.reservedQuantity;
  }

  async checkAvailability(itemId: string, quantity: number): Promise<boolean> {
    const available = await this.getAvailability(itemId);
    return available >= quantity;
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  getItem(itemId: string): InventoryItem | undefined {
    return this.inventory.get(itemId);
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }
}

export { InventoryReservationSystem, Reservation, InventoryItem };