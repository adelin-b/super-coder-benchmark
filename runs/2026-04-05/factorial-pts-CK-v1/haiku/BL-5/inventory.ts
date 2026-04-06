interface Reservation {
  reservationId: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

class InventoryReservationSystem {
  private stock: Map<string, number> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reserved: Map<string, number> = new Map();
  private reservationCounter: number = 0;

  addStock(itemId: string, quantity: number): void {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    if (!Number.isInteger(quantity)) {
      throw new Error('Quantity must be an integer');
    }
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    const currentStock = this.stock.get(itemId) || 0;
    this.stock.set(itemId, currentStock + quantity);
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    if (!Number.isInteger(quantity)) {
      throw new Error('Quantity must be an integer');
    }
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    const totalStock = this.stock.get(itemId) || 0;
    const currentReserved = this.reserved.get(itemId) || 0;
    const available = totalStock - currentReserved;

    if (available < quantity) {
      throw new Error(
        `Insufficient stock for item ${itemId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    const reservationId = `RES-${++this.reservationCounter}`;
    const reservation: Reservation = {
      reservationId,
      itemId,
      quantity,
      timestamp: Date.now()
    };

    this.reservations.set(reservationId, reservation);
    this.reserved.set(itemId, currentReserved + quantity);

    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId || reservationId.trim() === '') {
      throw new Error('Reservation ID cannot be empty');
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const currentReserved = this.reserved.get(reservation.itemId) || 0;
    this.reserved.set(reservation.itemId, Math.max(0, currentReserved - reservation.quantity));
    this.reservations.delete(reservationId);
  }

  checkAvailable(itemId: string): number {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }

    const totalStock = this.stock.get(itemId) || 0;
    const currentReserved = this.reserved.get(itemId) || 0;
    return Math.max(0, totalStock - currentReserved);
  }

  getTotalStock(itemId: string): number {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    return this.stock.get(itemId) || 0;
  }

  getReservedCount(itemId: string): number {
    if (!itemId || itemId.trim() === '') {
      throw new Error('Item ID cannot be empty');
    }
    return this.reserved.get(itemId) || 0;
  }

  getReservation(reservationId: string): Reservation | null {
    if (!reservationId || reservationId.trim() === '') {
      throw new Error('Reservation ID cannot be empty');
    }
    return this.reservations.get(reservationId) || null;
  }
}

export { InventoryReservationSystem };