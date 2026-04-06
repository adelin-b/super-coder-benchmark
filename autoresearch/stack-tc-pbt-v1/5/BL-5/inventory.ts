export class InventoryReservation {
  private total: number;
  private reserved: number;

  constructor(initialStock: number) {
    if (initialStock < 0) {
      throw new Error("Initial stock cannot be negative");
    }
    this.total = initialStock;
    this.reserved = 0;
  }

  reserve(quantity: number): boolean {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    if (quantity === 0) {
      throw new Error("Quantity must be greater than 0");
    }
    const available = this.total - this.reserved;
    if (available >= quantity) {
      this.reserved += quantity;
      return true;
    }
    return false;
  }

  release(quantity: number): void {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    if (quantity === 0) {
      throw new Error("Quantity must be greater than 0");
    }
    if (quantity > this.reserved) {
      throw new Error("Cannot release more than reserved");
    }
    this.reserved -= quantity;
  }

  checkAvailability(quantity: number): boolean {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    return this.total - this.reserved >= quantity;
  }

  getAvailable(): number {
    return this.total - this.reserved;
  }

  getReserved(): number {
    return this.reserved;
  }

  getTotal(): number {
    return this.total;
  }

  reset(): void {
    this.reserved = 0;
  }
}

export class ReservationManager {
  private reservations: Map<string, number> = new Map();
  private inventory: InventoryReservation;

  constructor(initialStock: number) {
    this.inventory = new InventoryReservation(initialStock);
  }

  reserve(reservationId: string, quantity: number): boolean {
    if (!reservationId) {
      throw new Error("Reservation ID cannot be empty");
    }
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (this.reservations.has(reservationId)) {
      throw new Error("Reservation already exists");
    }

    if (this.inventory.reserve(quantity)) {
      this.reservations.set(reservationId, quantity);
      return true;
    }
    return false;
  }

  release(reservationId: string): void {
    if (!reservationId) {
      throw new Error("Reservation ID cannot be empty");
    }
    const quantity = this.reservations.get(reservationId);
    if (quantity === undefined) {
      throw new Error("Reservation not found");
    }
    this.inventory.release(quantity);
    this.reservations.delete(reservationId);
  }

  checkAvailability(quantity: number): boolean {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    return this.inventory.checkAvailability(quantity);
  }

  getAvailable(): number {
    return this.inventory.getAvailable();
  }

  getReserved(): number {
    return this.inventory.getReserved();
  }

  getTotal(): number {
    return this.inventory.getTotal();
  }

  getReservationCount(): number {
    return this.reservations.size;
  }

  getReservation(reservationId: string): number | undefined {
    return this.reservations.get(reservationId);
  }
}