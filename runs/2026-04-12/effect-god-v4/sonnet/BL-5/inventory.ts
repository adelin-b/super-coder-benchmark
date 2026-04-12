export interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  expiresAt?: number;
}

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
    Object.setPrototypeOf(this, InventoryError.prototype);
  }
}

export function createInventory() {
  const stock = new Map<string, number>();
  const reservations = new Map<string, Reservation>();
  let nextId = 1;

  function getAvailable(sku: string): number {
    const total = stock.get(sku) ?? 0;
    let reserved = 0;
    const now = Date.now();
    for (const r of reservations.values()) {
      if (r.sku === sku && (r.expiresAt === undefined || r.expiresAt > now)) {
        reserved += r.quantity;
      }
    }
    return Math.max(0, total - reserved);
  }

  return {
    setStock(sku: string, qty: number): void {
      if (qty < 0) throw new InventoryError("Stock quantity cannot be negative");
      stock.set(sku, qty);
    },

    getAvailable,

    reserve(sku: string, qty: number, ttlMs?: number): string {
      if (qty <= 0) throw new InventoryError("Reservation quantity must be positive");
      const available = getAvailable(sku);
      if (available < qty) {
        throw new InventoryError(
          `Insufficient stock for SKU "${sku}": requested ${qty}, available ${available}`
        );
      }
      const id = `res-${nextId++}`;
      const reservation: Reservation = {
        id,
        sku,
        quantity: qty,
        expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : undefined,
      };
      reservations.set(id, reservation);
      return id;
    },

    release(reservationId: string): boolean {
      return reservations.delete(reservationId);
    },

    confirm(reservationId: string): boolean {
      const r = reservations.get(reservationId);
      if (!r) return false;
      const current = stock.get(r.sku) ?? 0;
      stock.set(r.sku, Math.max(0, current - r.quantity));
      reservations.delete(reservationId);
      return true;
    },
  };
}