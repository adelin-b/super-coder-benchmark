export interface InventoryItem {
  itemId: string;
  total: number;
  reserved: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

export class InventoryReservationSystem {
  private items: Map<string, InventoryItem>;
  private reservations: Map<string, Reservation>;
  private locks: Map<string, Promise<void>>;
  private counter: number;

  constructor() {
    this.items = new Map();
    this.reservations = new Map();
    this.locks = new Map();
    this.counter = 0;
  }

  private async acquireLock(itemId: string): Promise<void> {
    const currentLock = this.locks.get(itemId) || Promise.resolve();
    const newLock = currentLock.then(() => {});
    this.locks.set(itemId, newLock);
    await currentLock;
  }

  async addStock(itemId: string, quantity: number): Promise<void> {
    await this.acquireLock(itemId);
    const item = this.items.get(itemId);
    if (item) {
      item.total += quantity;
    } else {
      this.items.set(itemId, {
        itemId,
        total: quantity,
        reserved: 0,
      });
    }
  }

  async reserve(itemId: string, quantity: number): Promise<string> {
    await this.acquireLock(itemId);

    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    const available = item.total - item.reserved;
    if (available < quantity) {
      throw new Error(
        `Insufficient stock for item ${itemId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    item.reserved += quantity;
    const reservationId = `RES-${++this.counter}`;
    const reservation: Reservation = {
      id: reservationId,
      itemId,
      quantity,
      timestamp: Date.now(),
    };
    this.reservations.set(reservationId, reservation);

    return reservationId;
  }

  async release(reservationId: string): Promise<boolean> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return false;
    }

    await this.acquireLock(reservation.itemId);

    const item = this.items.get(reservation.itemId);
    if (item) {
      item.reserved -= reservation.quantity;
    }

    this.reservations.delete(reservationId);
    return true;
  }

  async confirm(reservationId: string): Promise<boolean> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return false;
    }

    await this.acquireLock(reservation.itemId);

    const item = this.items.get(reservation.itemId);
    if (item) {
      item.total -= reservation.quantity;
      item.reserved -= reservation.quantity;
    }

    this.reservations.delete(reservationId);
    return true;
  }

  async getAvailable(itemId: string): Promise<number> {
    await this.acquireLock(itemId);
    const item = this.items.get(itemId);
    if (!item) {
      return 0;
    }
    return item.total - item.reserved;
  }

  async getReserved(itemId: string): Promise<number> {
    await this.acquireLock(itemId);
    const item = this.items.get(itemId);
    return item?.reserved || 0;
  }

  async getTotal(itemId: string): Promise<number> {
    await this.acquireLock(itemId);
    const item = this.items.get(itemId);
    return item?.total || 0;
  }

  async isAvailable(itemId: string, quantity: number): Promise<boolean> {
    const available = await this.getAvailable(itemId);
    return available >= quantity;
  }

  async getReservation(reservationId: string): Promise<Reservation | null> {
    return this.reservations.get(reservationId) || null;
  }

  async listReservations(itemId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(
      (r) => r.itemId === itemId
    );
  }

  async getInventoryItem(itemId: string): Promise<InventoryItem | null> {
    return this.items.get(itemId) || null;
  }
}