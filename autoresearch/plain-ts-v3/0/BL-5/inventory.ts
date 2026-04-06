export class InsufficientStockError extends Error {
  constructor(itemId: string, requested: number, available: number) {
    super(`Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reservation ${reservationId} not found`);
    this.name = 'ReservationNotFoundError';
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityError';
  }
}

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}

export interface InventoryItem {
  id: string;
  name: string;
  totalQuantity: number;
  reservedQuantity: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
}

export class InventoryReservationSystem {
  private items: Map<string, InventoryItem>;
  private reservations: Map<string, Reservation>;
  private reservationCounter: number;
  private locked: Set<string>;

  constructor() {
    this.items = new Map();
    this.reservations = new Map();
    this.reservationCounter = 0;
    this.locked = new Set();
  }

  addItem(id: string, name: string, quantity: number): void {
    if (quantity < 0) {
      throw new InvalidQuantityError('Quantity cannot be negative');
    }
    if (!id || !name) {
      throw new InvalidQuantityError('Item id and name are required');
    }
    this.items.set(id, {
      id,
      name,
      totalQuantity: quantity,
      reservedQuantity: 0,
    });
  }

  reserve(itemId: string, quantity: number): string {
    if (quantity <= 0) {
      throw new InvalidQuantityError('Quantity must be greater than 0');
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }

    const available = item.totalQuantity - item.reservedQuantity;
    if (available < quantity) {
      throw new InsufficientStockError(itemId, quantity, available);
    }

    const reservationId = `RES-${++this.reservationCounter}`;
    const reservation: Reservation = {
      id: reservationId,
      itemId,
      quantity,
      createdAt: new Date(),
    };

    this.reservations.set(reservationId, reservation);
    item.reservedQuantity += quantity;

    return reservationId;
  }

  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    const item = this.items.get(reservation.itemId);
    if (item) {
      item.reservedQuantity -= reservation.quantity;
    }

    this.reservations.delete(reservationId);
  }

  getAvailable(itemId: string): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    return item.totalQuantity - item.reservedQuantity;
  }

  getInventory(itemId: string): InventoryItem {
    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    return { ...item };
  }

  getReservation(reservationId: string): Reservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }
    return { ...reservation, createdAt: new Date(reservation.createdAt) };
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values()).map(r => ({
      ...r,
      createdAt: new Date(r.createdAt),
    }));
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values()).map(item => ({ ...item }));
  }

  updateItemQuantity(itemId: string, newQuantity: number): void {
    if (newQuantity < 0) {
      throw new InvalidQuantityError('Quantity cannot be negative');
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }

    if (newQuantity < item.reservedQuantity) {
      throw new InvalidQuantityError(
        `Cannot reduce quantity below reserved amount. Reserved: ${item.reservedQuantity}, New quantity: ${newQuantity}`
      );
    }

    item.totalQuantity = newQuantity;
  }

  releaseAllReservations(): void {
    this.reservations.forEach((reservation, id) => {
      this.release(id);
    });
  }

  getReservationsByItem(itemId: string): Reservation[] {
    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    return Array.from(this.reservations.values())
      .filter(r => r.itemId === itemId)
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }
}