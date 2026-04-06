interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

class InventoryReservationSystem {
  private stock: Map<string, number> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reservationCounter: number = 0;

  addStock(itemId: string, quantity: number): void {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('Invalid itemId');
    }
    if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
      throw new Error('Invalid quantity');
    }

    const current = this.stock.get(itemId) || 0;
    this.stock.set(itemId, current + quantity);
  }

  reserve(itemId: string, quantity: number): string {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('Invalid itemId');
    }
    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Invalid quantity');
    }

    const available = this.checkAvailability(itemId);
    if (available < quantity) {
      throw new Error('Insufficient stock available');
    }

    const reservationId = `RES-${Date.now()}-${++this.reservationCounter}`;
    const reservation: Reservation = {
      id: reservationId,
      itemId,
      quantity,
      timestamp: Date.now(),
    };

    this.reservations.set(reservationId, reservation);
    return reservationId;
  }

  release(reservationId: string): void {
    if (typeof reservationId !== 'string' || !reservationId) {
      throw new Error('Invalid reservationId');
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string): number {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('Invalid itemId');
    }

    const total = this.stock.get(itemId) || 0;
    const reserved = Array.from(this.reservations.values())
      .filter(r => r.itemId === itemId)
      .reduce((sum, r) => sum + r.quantity, 0);

    return Math.max(0, total - reserved);
  }

  getReserved(itemId: string): number {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('Invalid itemId');
    }

    return Array.from(this.reservations.values())
      .filter(r => r.itemId === itemId)
      .reduce((sum, r) => sum + r.quantity, 0);
  }

  getTotal(itemId: string): number {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('Invalid itemId');
    }

    return this.stock.get(itemId) || 0;
  }

  getReservation(reservationId: string): Reservation | undefined {
    if (typeof reservationId !== 'string' || !reservationId) {
      throw new Error('Invalid reservationId');
    }

    return this.reservations.get(reservationId);
  }
}

export const createInventoryReservationSystem = (): InventoryReservationSystem => {
  return new InventoryReservationSystem();
};

export { InventoryReservationSystem };
export type { Reservation };