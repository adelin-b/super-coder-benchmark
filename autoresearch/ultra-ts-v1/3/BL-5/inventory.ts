export interface Reservation {
  id: string;
  quantity: number;
  expiresAt?: number;
}

export interface InventoryManager {
  reserve(quantity: number, expirationMs?: number): string;
  release(reservationId: string): void;
  confirm(reservationId: string): void;
  getAvailable(): number;
  getStock(): number;
  setStock(quantity: number): void;
}

export function createInventory(initialStock: number): InventoryManager {
  if (initialStock < 0) throw new Error("Stock cannot be negative");
  
  let totalStock = initialStock;
  const reservations = new Map<string, Reservation>();
  let reservationCounter = 0;

  function getAvailable(): number {
    const now = Date.now();
    let reserved = 0;
    
    for (const reservation of reservations.values()) {
      if (reservation.expiresAt !== undefined && reservation.expiresAt <= now) {
        continue;
      }
      reserved += reservation.quantity;
    }
    
    return Math.max(0, totalStock - reserved);
  }

  function getStock(): number {
    return totalStock;
  }

  function setStock(quantity: number): void {
    if (quantity < 0) throw new Error("Stock cannot be negative");
    totalStock = quantity;
  }

  function reserve(quantity: number, expirationMs?: number): string {
    if (quantity < 0) throw new Error("Quantity cannot be negative");
    if (quantity === 0) throw new Error("Quantity must be greater than 0");
    
    const available = getAvailable();
    if (quantity > available) throw new Error("Insufficient stock");

    const reservationId = `res_${++reservationCounter}`;
    const expiresAt = expirationMs !== undefined ? Date.now() + expirationMs : undefined;
    
    reservations.set(reservationId, {
      id: reservationId,
      quantity,
      expiresAt,
    });

    return reservationId;
  }

  function release(reservationId: string): void {
    if (!reservations.has(reservationId)) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    reservations.delete(reservationId);
  }

  function confirm(reservationId: string): void {
    const reservation = reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const now = Date.now();
    if (reservation.expiresAt !== undefined && reservation.expiresAt <= now) {
      reservations.delete(reservationId);
      throw new Error(`Reservation ${reservationId} has expired`);
    }

    totalStock -= reservation.quantity;
    if (totalStock < 0) totalStock = 0;
    reservations.delete(reservationId);
  }

  return {
    reserve,
    release,
    confirm,
    getAvailable,
    getStock,
    setStock,
  };
}