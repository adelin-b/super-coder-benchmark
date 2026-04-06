export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
}

export class InventoryReservationSystem {
  private inventory: Map<string, number> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private nextId: number = 0;

  addStock(itemId: string, quantity: number): void {
    if (!itemId) throw new Error("Item ID is required");
    if (quantity < 0) throw new Error("Quantity cannot be negative");
    const current = this.inventory.get(itemId) ?? 0;
    this.inventory.set(itemId, current + quantity);
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId) throw new Error("Item ID is required");
    if (quantity <= 0) throw new Error("Quantity must be positive");
    
    const available = this.inventory.get(itemId) ?? 0;
    if (available < quantity) {
      throw new Error("Insufficient stock");
    }

    const reservationId = `RES-${++this.nextId}`;
    this.inventory.set(itemId, available - quantity);
    this.reservations.set(reservationId, { id: reservationId, itemId, quantity });
    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId) throw new Error("Reservation ID is required");
    
    const reservation = this.reservations.get(reservationId);
    if (!reservation) throw new Error("Reservation not found");

    const { itemId, quantity } = reservation;
    const current = this.inventory.get(itemId) ?? 0;
    this.inventory.set(itemId, current + quantity);
    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string): number {
    if (!itemId) throw new Error("Item ID is required");
    return this.inventory.get(itemId) ?? 0;
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }
}