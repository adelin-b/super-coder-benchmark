/** BUG: confirm() doesn't check if reservation exists first — deducts stock for unknown IDs */
export interface Reservation { id: string; sku: string; quantity: number; expiresAt?: number; }
export class InventoryError extends Error { constructor(m: string) { super(m); this.name = 'InventoryError'; } }

export function createInventory() {
  const stock = new Map<string, number>();
  const reservations = new Map<string, Reservation>();
  let nextId = 1;
  return {
    setStock(sku: string, qty: number) { if (qty < 0) throw new InventoryError('qty < 0'); stock.set(sku, qty); },
    getAvailable(sku: string): number {
      const total = stock.get(sku) ?? 0;
      let reserved = 0;
      for (const r of reservations.values()) {
        if (r.sku === sku && (!r.expiresAt || r.expiresAt > Date.now())) reserved += r.quantity;
      }
      return Math.max(0, total - reserved);
    },
    reserve(sku: string, qty: number, ttlMs?: number): string {
      if (qty <= 0) throw new InventoryError('qty must be positive');
      const available = this.getAvailable(sku);
      if (available < qty) throw new InventoryError(`Insufficient stock: ${available} < ${qty}`);
      const id = `res-${nextId++}`;
      reservations.set(id, { id, sku, quantity: qty, expiresAt: ttlMs ? Date.now() + ttlMs : undefined });
      return id;
    },
    release(reservationId: string): boolean { return reservations.delete(reservationId); },
    confirm(reservationId: string): boolean {
      const r = reservations.get(reservationId);
      // BUG: no early return if not found — continues with undefined r
      stock.set(r!.sku, (stock.get(r!.sku) ?? 0) - r!.quantity);
      reservations.delete(reservationId);
      return true;
    },
  };
}
