import crypto from 'crypto';

export interface Reservation {
  id: string;
  quantity: number;
  timestamp: number;
}

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class InvalidReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReservationError';
  }
}

export class InventoryReservationSystem {
  private totalStock: number;
  private reservedQuantity: number;
  private reservations: Map<string, Reservation>;

  constructor(initialStock: number) {
    if (initialStock < 0) {
      throw new Error('Initial stock cannot be negative');
    }
    this.totalStock = initialStock;
    this.reservedQuantity = 0;
    this.reservations = new Map();
  }

  /**
   * Reserve stock and return a reservation ID
   */
  reserve(quantity: number): string {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const available = this.getAvailable();
    if (quantity > available) {
      throw new InsufficientStockError(
        `Cannot reserve ${quantity} units. Only ${available} units available.`
      );
    }

    const reservationId = this.generateReservationId();
    const reservation: Reservation = {
      id: reservationId,
      quantity,
      timestamp: Date.now(),
    };

    this.reservations.set(reservationId, reservation);
    this.reservedQuantity += quantity;

    return reservationId;
  }

  /**
   * Release a reservation and return the quantity back to available stock
   */
  release(reservationId: string): number {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      throw new InvalidReservationError(
        `Reservation with ID "${reservationId}" not found`
      );
    }

    const quantity = reservation.quantity;
    this.reservations.delete(reservationId);
    this.reservedQuantity -= quantity;

    return quantity;
  }

  /**
   * Get the amount of stock available for reservation
   */
  getAvailable(): number {
    return this.totalStock - this.reservedQuantity;
  }

  /**
   * Get the total stock
   */
  getTotalStock(): number {
    return this.totalStock;
  }

  /**
   * Get the total reserved quantity
   */
  getReservedQuantity(): number {
    return this.reservedQuantity;
  }

  /**
   * Get all active reservations
   */
  getReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * Check if a reservation exists
   */
  hasReservation(reservationId: string): boolean {
    return this.reservations.has(reservationId);
  }

  /**
   * Get a specific reservation details
   */
  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  /**
   * Adjust total stock (for restock or adjustment)
   */
  adjustStock(amount: number): void {
    const newTotal = this.totalStock + amount;
    if (newTotal < this.reservedQuantity) {
      throw new Error(
        `Cannot reduce stock below reserved quantity (${this.reservedQuantity})`
      );
    }
    if (newTotal < 0) {
      throw new Error('Total stock cannot be negative');
    }
    this.totalStock = newTotal;
  }

  /**
   * Clear all reservations (for testing or reset)
   */
  clearReservations(): void {
    this.reservedQuantity = 0;
    this.reservations.clear();
  }

  private generateReservationId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}