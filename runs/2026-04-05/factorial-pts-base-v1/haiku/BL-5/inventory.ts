interface InventoryItem {
  id: string;
  name: string;
  available: number;
  reserved: number;
}

interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
}

class InventoryReservationSystem {
  private items: Map<string, InventoryItem> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reservationCounter: number = 0;
  private lock: Promise<void> = Promise.resolve();

  private async acquireLock(): Promise<() => void> {
    let releaseLock: () => void;
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await this.lock;
    this.lock = newLock;
    return releaseLock!;
  }

  addItem(id: string, name: string, quantity: number): void {
    this.items.set(id, {
      id,
      name,
      available: quantity,
      reserved: 0
    });
  }

  async reserve(itemId: string, quantity: number): Promise<string> {
    const release = await this.acquireLock();
    try {
      const item = this.items.get(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      if (item.available < quantity) {
        throw new Error(
          `Insufficient inventory for ${itemId}: available=${item.available}, requested=${quantity}`
        );
      }

      item.available -= quantity;
      item.reserved += quantity;

      const reservationId = `RES-${++this.reservationCounter}`;
      const reservation: Reservation = {
        id: reservationId,
        itemId,
        quantity,
        createdAt: new Date()
      };

      this.reservations.set(reservationId, reservation);
      return reservationId;
    } finally {
      release();
    }
  }

  async release(reservationId: string): Promise<void> {
    const release = await this.acquireLock();
    try {
      const reservation = this.reservations.get(reservationId);
      if (!reservation) {
        throw new Error(`Reservation ${reservationId} not found`);
      }

      const item = this.items.get(reservation.itemId);
      if (item) {
        item.available += reservation.quantity;
        item.reserved -= reservation.quantity;
      }

      this.reservations.delete(reservationId);
    } finally {
      release();
    }
  }

  async checkAvailability(itemId: string): Promise<number> {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return item.available;
  }

  async getItemDetails(itemId: string): Promise<InventoryItem> {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }
    return { ...item };
  }

  async getReservation(reservationId: string): Promise<Reservation> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    return { ...reservation };
  }

  async getAllItems(): Promise<InventoryItem[]> {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }

  async getAllReservations(): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).map((res) => ({ ...res }));
  }
}

export { InventoryReservationSystem, InventoryItem, Reservation };