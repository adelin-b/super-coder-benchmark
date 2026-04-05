export interface ReservationInfo {
  itemId: string;
  quantity: number;
  reservationId: string;
  timestamp: number;
}

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(itemId: string, requested: number, available: number) {
    super(
      `Insufficient stock for item ${itemId}: requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationNotFoundError extends InventoryError {
  constructor(reservationId: string) {
    super(`Reservation ${reservationId} not found`);
    this.name = "ReservationNotFoundError";
  }
}

export class InventoryReservationSystem {
  private inventory: Map<string, number> = new Map();
  private reservations: Map<string, ReservationInfo> = new Map();
  private reservationCounter: number = 0;

  /**
   * Add stock to inventory
   */
  public addStock(itemId: string, quantity: number): void {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }
    if (quantity < 0) {
      throw new InventoryError("Quantity cannot be negative");
    }
    if (!Number.isInteger(quantity)) {
      throw new InventoryError("Quantity must be an integer");
    }

    const current = this.inventory.get(itemId) ?? 0;
    this.inventory.set(itemId, current + quantity);
  }

  /**
   * Get total available stock (not reserved)
   */
  public getAvailable(itemId: string): number {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }

    const total = this.inventory.get(itemId) ?? 0;
    const reserved = this.getReserved(itemId);
    return Math.max(0, total - reserved);
  }

  /**
   * Get total reserved quantity
   */
  public getReserved(itemId: string): number {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }

    let reserved = 0;
    for (const reservation of this.reservations.values()) {
      if (reservation.itemId === itemId) {
        reserved += reservation.quantity;
      }
    }
    return reserved;
  }

  /**
   * Get total inventory (available + reserved)
   */
  public getTotal(itemId: string): number {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }

    return this.inventory.get(itemId) ?? 0;
  }

  /**
   * Reserve stock
   */
  public reserve(itemId: string, quantity: number): string {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }
    if (quantity <= 0) {
      throw new InventoryError("Quantity must be positive");
    }
    if (!Number.isInteger(quantity)) {
      throw new InventoryError("Quantity must be an integer");
    }

    const available = this.getAvailable(itemId);
    if (available < quantity) {
      throw new InsufficientStockError(itemId, quantity, available);
    }

    const reservationId = `RES-${++this.reservationCounter}`;
    const reservation: ReservationInfo = {
      itemId,
      quantity,
      reservationId,
      timestamp: Date.now(),
    };

    this.reservations.set(reservationId, reservation);
    return reservationId;
  }

  /**
   * Release a reservation
   */
  public release(reservationId: string): void {
    if (!reservationId) {
      throw new InventoryError("Reservation ID cannot be empty");
    }

    if (!this.reservations.has(reservationId)) {
      throw new ReservationNotFoundError(reservationId);
    }

    this.reservations.delete(reservationId);
  }

  /**
   * Release by item ID (releases all reservations for an item)
   */
  public releaseByItemId(itemId: string): number {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }

    let releasedCount = 0;
    const toDelete: string[] = [];

    for (const [resId, reservation] of this.reservations.entries()) {
      if (reservation.itemId === itemId) {
        toDelete.push(resId);
        releasedCount++;
      }
    }

    for (const resId of toDelete) {
      this.reservations.delete(resId);
    }

    return releasedCount;
  }

  /**
   * Get reservation details
   */
  public getReservation(reservationId: string): ReservationInfo {
    if (!reservationId) {
      throw new InventoryError("Reservation ID cannot be empty");
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    return { ...reservation };
  }

  /**
   * Get all reservations
   */
  public getAllReservations(): ReservationInfo[] {
    return Array.from(this.reservations.values()).map((r) => ({ ...r }));
  }

  /**
   * Get all reservations for an item
   */
  public getReservationsByItemId(itemId: string): ReservationInfo[] {
    if (!itemId) {
      throw new InventoryError("Item ID cannot be empty");
    }

    return Array.from(this.reservations.values())
      .filter((r) => r.itemId === itemId)
      .map((r) => ({ ...r }));
  }

  /**
   * Clear all data (for testing/reset)
   */
  public clear(): void {
    this.inventory.clear();
    this.reservations.clear();
    this.reservationCounter = 0;
  }
}