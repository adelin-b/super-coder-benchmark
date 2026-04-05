// Error classes
export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
    this.name = 'InsufficientStockError';
  }
}

export class ItemNotFoundError extends InventoryError {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}

export class ReservationNotFoundError extends InventoryError {
  constructor(reservationId: string) {
    super(`Reservation ${reservationId} not found`);
    this.name = 'ReservationNotFoundError';
  }
}

// Types
export interface InventoryItem {
  id: string;
  name: string;
  available: number;
  reserved: number;
  total: number;
}

export interface ReservationToken {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
}

// Main reservation system
export class InventoryReservationSystem {
  private inventory: Map<string, InventoryItem>;
  private reservations: Map<string, ReservationToken>;
  private nextReservationId: number;

  constructor() {
    this.inventory = new Map();
    this.reservations = new Map();
    this.nextReservationId = 0;
  }

  addItem(id: string, name: string, quantity: number): InventoryItem {
    if (this.inventory.has(id)) {
      throw new InventoryError(`Item ${id} already exists`);
    }

    if (quantity < 0) {
      throw new InventoryError('Quantity cannot be negative');
    }

    const item: InventoryItem = {
      id,
      name,
      available: quantity,
      reserved: 0,
      total: quantity,
    };

    this.inventory.set(id, item);
    return { ...item };
  }

  reserve(itemId: string, quantity: number): ReservationToken {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }

    if (quantity <= 0) {
      throw new InventoryError('Reservation quantity must be positive');
    }

    if (item.available < quantity) {
      throw new InsufficientStockError(itemId, quantity, item.available);
    }

    const reservationId = `res_${this.nextReservationId++}`;
    const token: ReservationToken = {
      id: reservationId,
      itemId,
      quantity,
      createdAt: new Date(),
    };

    item.available -= quantity;
    item.reserved += quantity;
    this.reservations.set(reservationId, token);

    return token;
  }

  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    const item = this.inventory.get(reservation.itemId);
    if (!item) {
      throw new ItemNotFoundError(reservation.itemId);
    }

    item.available += reservation.quantity;
    item.reserved -= reservation.quantity;
    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string, quantity: number): boolean {
    const item = this.inventory.get(itemId);
    if (!item) {
      return false;
    }
    return item.available >= quantity;
  }

  getInventoryStatus(itemId: string): InventoryItem | null {
    const item = this.inventory.get(itemId);
    return item ? { ...item } : null;
  }

  getAllInventory(): InventoryItem[] {
    return Array.from(this.inventory.values()).map((item) => ({ ...item }));
  }

  getReservation(reservationId: string): ReservationToken | null {
    const reservation = this.reservations.get(reservationId);
    return reservation ? { ...reservation } : null;
  }

  getAllReservations(itemId?: string): ReservationToken[] {
    const reservations = Array.from(this.reservations.values());
    if (itemId) {
      return reservations
        .filter((r) => r.itemId === itemId)
        .map((r) => ({ ...r }));
    }
    return reservations.map((r) => ({ ...r }));
  }

  updateItemQuantity(itemId: string, newTotal: number): InventoryItem {
    const item = this.inventory.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }

    if (newTotal < 0) {
      throw new InventoryError('Total quantity cannot be negative');
    }

    if (newTotal < item.reserved) {
      throw new InventoryError(
        `Cannot reduce quantity below reserved amount (reserved: ${item.reserved})`
      );
    }

    const delta = newTotal - item.total;
    item.total = newTotal;
    item.available += delta;

    return { ...item };
  }

  cancelReservation(reservationId: string): void {
    this.release(reservationId);
  }

  commitReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    const item = this.inventory.get(reservation.itemId);
    if (!item) {
      throw new ItemNotFoundError(reservation.itemId);
    }

    item.reserved -= reservation.quantity;
    this.reservations.delete(reservationId);
  }

  getAvailableQuantity(itemId: string): number {
    const item = this.inventory.get(itemId);
    return item ? item.available : 0;
  }

  getReservedQuantity(itemId: string): number {
    const item = this.inventory.get(itemId);
    return item ? item.reserved : 0;
  }

  getTotalQuantity(itemId: string): number {
    const item = this.inventory.get(itemId);
    return item ? item.total : 0;
  }
}