import { randomUUID } from 'crypto';

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  expiresAt?: number;
  confirmed: boolean;
}

interface InventoryManager {
  setStock(sku: string, quantity: number): void;
  getAvailable(sku: string): number;
  reserve(sku: string, quantity: number, ttl?: number): string;
  release(id: string): void;
  confirm(id: string): void;
}

export function createInventory(): InventoryManager {
  const stock = new Map<string, number>();
  const reservations = new Map<string, Reservation>();

  function cleanExpiredReservations(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, res] of reservations.entries()) {
      if (res.expiresAt && res.expiresAt <= now && !res.confirmed) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      reservations.delete(id);
    }
  }

  function getAvailable(sku: string): number {
    cleanExpiredReservations();

    const totalStock = stock.get(sku) ?? 0;
    let reserved = 0;

    for (const res of reservations.values()) {
      if (res.sku === sku && !res.confirmed) {
        reserved += res.quantity;
      }
    }

    return totalStock - reserved;
  }

  function setStock(sku: string, quantity: number): void {
    stock.set(sku, quantity);
  }

  function reserve(sku: string, quantity: number, ttl?: number): string {
    if (quantity < 0) {
      throw new InventoryError('Quantity cannot be negative');
    }

    cleanExpiredReservations();

    const available = getAvailable(sku);
    if (available < quantity) {
      throw new InventoryError(
        `Insufficient stock for ${sku}: need ${quantity}, have ${available}`
      );
    }

    const id = randomUUID();
    const reservation: Reservation = {
      id,
      sku,
      quantity,
      confirmed: false,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };

    reservations.set(id, reservation);
    return id;
  }

  function release(id: string): void {
    const res = reservations.get(id);
    if (!res) {
      throw new InventoryError(`Reservation ${id} not found`);
    }
    if (res.confirmed) {
      throw new InventoryError(`Reservation ${id} already confirmed`);
    }
    reservations.delete(id);
  }

  function confirm(id: string): void {
    const res = reservations.get(id);
    if (!res) {
      throw new InventoryError(`Reservation ${id} not found`);
    }
    if (res.confirmed) {
      throw new InventoryError(`Reservation ${id} already confirmed`);
    }
    res.confirmed = true;
  }

  return {
    setStock,
    getAvailable,
    reserve,
    release,
    confirm,
  };
}