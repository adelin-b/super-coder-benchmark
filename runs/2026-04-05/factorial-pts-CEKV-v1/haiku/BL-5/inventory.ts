interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  timestamp: number;
}

interface InventoryItem {
  available: number;
  reserved: number;
}

export class Inventory {
  private items: Map<string, InventoryItem>;
  private reservations: Map<string, Reservation>;
  private reservationCounter: number;

  constructor() {
    this.items = new Map();
    this.reservations = new Map();
    this.reservationCounter = 0;
  }

  addStock(itemId: string, quantity: number): void {
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new Error("Item ID must be a non-empty string");
    }
    if (typeof quantity !== "number" || quantity <= 0) {
      throw new Error("Quantity must be a positive number");
    }

    if (!this.items.has(itemId)) {
      this.items.set(itemId, { available: 0, reserved: 0 });
    }

    this.items.get(itemId)!.available += quantity;
  }

  reserve(itemId: string, quantity: number): string {
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new Error("Item ID must be a non-empty string");
    }
    if (typeof quantity !== "number" || quantity <= 0) {
      throw new Error("Quantity must be a positive number");
    }

    if (!this.items.has(itemId)) {
      this.items.set(itemId, { available: 0, reserved: 0 });
    }

    const item = this.items.get(itemId)!;
    if (item.available < quantity) {
      throw new Error("Insufficient inventory available");
    }

    item.available -= quantity;
    item.reserved += quantity;

    const reservationId = `RES-${++this.reservationCounter}`;
    this.reservations.set(reservationId, {
      id: reservationId,
      itemId,
      quantity,
      timestamp: Date.now(),
    });

    return reservationId;
  }

  release(reservationId: string): void {
    if (typeof reservationId !== "string" || !reservationId.trim()) {
      throw new Error("Reservation ID must be a non-empty string");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    const item = this.items.get(reservation.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    item.available += reservation.quantity;
    item.reserved -= reservation.quantity;
    this.reservations.delete(reservationId);
  }

  getAvailable(itemId: string): number {
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new Error("Item ID must be a non-empty string");
    }

    if (!this.items.has(itemId)) {
      return 0;
    }

    return this.items.get(itemId)!.available;
  }

  getReserved(itemId: string): number {
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new Error("Item ID must be a non-empty string");
    }

    if (!this.items.has(itemId)) {
      return 0;
    }

    return this.items.get(itemId)!.reserved;
  }

  getTotal(itemId: string): number {
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new Error("Item ID must be a non-empty string");
    }

    if (!this.items.has(itemId)) {
      return 0;
    }

    const item = this.items.get(itemId)!;
    return item.available + item.reserved;
  }
}