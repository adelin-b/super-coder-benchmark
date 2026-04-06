export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationError";
  }
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

export interface InventoryItem {
  id: string;
  totalStock: number;
  reserved: number;
  available: number;
}

interface InternalItem {
  id: string;
  totalStock: number;
  reserved: number;
}

interface InternalReservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

export class Inventory {
  private items: Map<string, InternalItem> = new Map();
  private reservations: Map<string, InternalReservation> = new Map();
  private nextReservationId = 0;

  addStock(itemId: string, quantity: number): void {
    if (!itemId || itemId.trim() === "") {
      throw new ReservationError("Item ID cannot be empty");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ReservationError("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (item) {
      item.totalStock += quantity;
    } else {
      this.items.set(itemId, {
        id: itemId,
        totalStock: quantity,
        reserved: 0,
      });
    }
  }

  reserve(itemId: string, quantity: number): string {
    if (!itemId || itemId.trim() === "") {
      throw new ReservationError("Item ID cannot be empty");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ReservationError("Quantity must be a positive integer");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new ReservationError(`Item not found: ${itemId}`);
    }

    const available = item.totalStock - item.reserved;
    if (available < quantity) {
      throw new ReservationError(
        `Insufficient stock for ${itemId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    item.reserved += quantity;
    const reservationId = `RES-${++this.nextReservationId}`;

    this.reservations.set(reservationId, {
      id: reservationId,
      itemId,
      quantity,
      timestamp: Date.now(),
    });

    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId || reservationId.trim() === "") {
      throw new ReservationError("Reservation ID cannot be empty");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationError(`Reservation not found: ${reservationId}`);
    }

    const item = this.items.get(reservation.itemId);
    if (item) {
      item.reserved = Math.max(0, item.reserved - reservation.quantity);
    }

    this.reservations.delete(reservationId);
  }

  checkAvailability(itemId: string): number {
    if (!itemId || itemId.trim() === "") {
      throw new ReservationError("Item ID cannot be empty");
    }

    const item = this.items.get(itemId);
    if (!item) {
      return 0;
    }
    return Math.max(0, item.totalStock - item.reserved);
  }

  getStatus(itemId: string): InventoryItem {
    if (!itemId || itemId.trim() === "") {
      throw new ReservationError("Item ID cannot be empty");
    }

    const item = this.items.get(itemId);
    if (!item) {
      throw new ReservationError(`Item not found: ${itemId}`);
    }

    return {
      id: item.id,
      totalStock: item.totalStock,
      reserved: item.reserved,
      available: Math.max(0, item.totalStock - item.reserved),
    };
  }

  getReservation(reservationId: string): Reservation {
    if (!reservationId || reservationId.trim() === "") {
      throw new ReservationError("Reservation ID cannot be empty");
    }

    const res = this.reservations.get(reservationId);
    if (!res) {
      throw new ReservationError(`Reservation not found: ${reservationId}`);
    }
    return res;
  }

  listReservations(itemId?: string): Reservation[] {
    const list = Array.from(this.reservations.values());
    if (itemId && itemId.trim() !== "") {
      return list.filter((r) => r.itemId === itemId);
    }
    return list;
  }

  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values()).map((item) => ({
      id: item.id,
      totalStock: item.totalStock,
      reserved: item.reserved,
      available: Math.max(0, item.totalStock - item.reserved),
    }));
  }

  confirmReservation(reservationId: string): void {
    if (!reservationId || reservationId.trim() === "") {
      throw new ReservationError("Reservation ID cannot be empty");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationError(`Reservation not found: ${reservationId}`);
    }

    this.reservations.delete(reservationId);
  }

  reset(): void {
    this.items.clear();
    this.reservations.clear();
    this.nextReservationId = 0;
  }
}