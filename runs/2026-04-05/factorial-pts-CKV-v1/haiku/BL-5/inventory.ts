export class InventoryReservationSystem {
  private stock: Map<string, number>;
  private reservations: Map<string, { itemId: string; quantity: number }>;
  private reservationCounter: number;

  constructor() {
    this.stock = new Map();
    this.reservations = new Map();
    this.reservationCounter = 0;
  }

  setStock(itemId: string, quantity: number): void {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error('Quantity must be a non-negative integer');
    }
    this.stock.set(itemId, quantity);
  }

  checkAvailability(itemId: string): number {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    return this.stock.get(itemId) ?? 0;
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID must be a non-empty string');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive integer');
    }

    const available = this.stock.get(itemId) ?? 0;
    if (available < quantity) {
      throw new Error(`Insufficient stock for item ${itemId}: required ${quantity}, available ${available}`);
    }

    this.stock.set(itemId, available - quantity);
    const reservationId = `RES-${++this.reservationCounter}`;
    this.reservations.set(reservationId, { itemId, quantity });

    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId || typeof reservationId !== 'string') {
      throw new Error('Reservation ID must be a non-empty string');
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    const current = this.stock.get(reservation.itemId) ?? 0;
    this.stock.set(reservation.itemId, current + reservation.quantity);
    this.reservations.delete(reservationId);
  }
}