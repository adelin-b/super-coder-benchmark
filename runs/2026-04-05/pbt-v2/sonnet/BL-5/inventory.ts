export class InsufficientStockError extends Error {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `Insufficient stock for SKU "${sku}": requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation "${reservationId}" not found`);
    this.name = "ReservationNotFoundError";
  }
}

export class SkuNotFoundError extends Error {
  constructor(public readonly sku: string) {
    super(`SKU "${sku}" not found in inventory`);
    this.name = "SkuNotFoundError";
  }
}

export interface InventoryItem {
  sku: string;
  totalQuantity: number;
  reservedQuantity: number;
}

export interface Reservation {
  id: string;
  sku: string;
  quantity: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ReserveOptions {
  /** Milliseconds until reservation expires and stock is released automatically */
  ttlMs?: number;
}

export interface AvailabilityResult {
  sku: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

function generateId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class InventoryStore {
  private items = new Map<string, InventoryItem>();
  private reservations = new Map<string, Reservation>();
  private expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Add or update a SKU with a given total quantity.
   * If the SKU already exists, totalQuantity is set (not added).
   */
  setStock(sku: string, totalQuantity: number): void {
    if (totalQuantity < 0) {
      throw new RangeError("totalQuantity must be >= 0");
    }
    const existing = this.items.get(sku);
    this.items.set(sku, {
      sku,
      totalQuantity,
      reservedQuantity: existing?.reservedQuantity ?? 0,
    });
  }

  /**
   * Add stock to an existing SKU (or create it with the given quantity).
   */
  addStock(sku: string, quantity: number): void {
    if (quantity <= 0) {
      throw new RangeError("quantity must be > 0");
    }
    const existing = this.items.get(sku);
    if (existing) {
      existing.totalQuantity += quantity;
    } else {
      this.items.set(sku, { sku, totalQuantity: quantity, reservedQuantity: 0 });
    }
  }

  /**
   * Reserve `quantity` units of a SKU.
   * Returns a Reservation object with a unique id.
   * Throws InsufficientStockError if not enough available stock.
   * Throws SkuNotFoundError if SKU is unknown.
   */
  reserve(sku: string, quantity: number, options: ReserveOptions = {}): Reservation {
    if (quantity <= 0) {
      throw new RangeError("quantity must be > 0");
    }

    const item = this.items.get(sku);
    if (!item) throw new SkuNotFoundError(sku);

    const available = item.totalQuantity - item.reservedQuantity;
    if (quantity > available) {
      throw new InsufficientStockError(sku, quantity, available);
    }

    item.reservedQuantity += quantity;

    const now = new Date();
    const expiresAt =
      options.ttlMs != null ? new Date(now.getTime() + options.ttlMs) : null;

    const reservation: Reservation = {
      id: generateId(),
      sku,
      quantity,
      createdAt: now,
      expiresAt,
    };

    this.reservations.set(reservation.id, reservation);

    if (options.ttlMs != null) {
      const timer = setTimeout(() => {
        this.releaseIfExists(reservation.id);
      }, options.ttlMs);
      // Allow Node.js to exit even if timer is pending
      if (typeof timer === "object" && timer !== null && "unref" in timer) {
        (timer as NodeJS.Timeout).unref();
      }
      this.expiryTimers.set(reservation.id, timer);
    }

    return { ...reservation };
  }

  /**
   * Release a reservation by id, returning reserved stock to available pool.
   * Throws ReservationNotFoundError if id is unknown.
   */
  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    this._doRelease(reservation);
  }

  private releaseIfExists(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (reservation) {
      this._doRelease(reservation);
    }
  }

  private _doRelease(reservation: Reservation): void {
    const item = this.items.get(reservation.sku);
    if (item) {
      item.reservedQuantity = Math.max(
        0,
        item.reservedQuantity - reservation.quantity
      );
    }

    this.reservations.delete(reservation.id);

    const timer = this.expiryTimers.get(reservation.id);
    if (timer != null) {
      clearTimeout(timer);
      this.expiryTimers.delete(reservation.id);
    }
  }

  /**
   * Confirm (consume) a reservation — removes the reservation and decrements totalQuantity.
   * Throws ReservationNotFoundError if id is unknown.
   */
  confirm(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    const item = this.items.get(reservation.sku);
    if (item) {
      item.reservedQuantity = Math.max(
        0,
        item.reservedQuantity - reservation.quantity
      );
      item.totalQuantity = Math.max(
        0,
        item.totalQuantity - reservation.quantity
      );
    }

    this.reservations.delete(reservation.id);

    const timer = this.expiryTimers.get(reservationId);
    if (timer != null) {
      clearTimeout(timer);
      this.expiryTimers.delete(reservationId);
    }
  }

  /**
   * Check availability for a SKU.
   * Throws SkuNotFoundError if SKU is unknown.
   */
  checkAvailability(sku: string): AvailabilityResult {
    const item = this.items.get(sku);
    if (!item) throw new SkuNotFoundError(sku);

    return {
      sku: item.sku,
      totalQuantity: item.totalQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.totalQuantity - item.reservedQuantity,
    };
  }

  /**
   * Returns true if at least `quantity` units are available for the given SKU.
   */
  isAvailable(sku: string, quantity: number): boolean {
    const item = this.items.get(sku);
    if (!item) return false;
    return item.totalQuantity - item.reservedQuantity >= quantity;
  }

  /**
   * Get a snapshot of a reservation by id. Returns null if not found.
   */
  getReservation(reservationId: string): Reservation | null {
    const r = this.reservations.get(reservationId);
    return r ? { ...r } : null;
  }

  /**
   * List all active reservations for a SKU.
   */
  listReservations(sku: string): Reservation[] {
    const results: Reservation[] = [];
    for (const r of this.reservations.values()) {
      if (r.sku === sku) results.push({ ...r });
    }
    return results;
  }

  /**
   * Release all reservations (e.g. for cleanup in tests).
   */
  releaseAll(): void {
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();

    for (const item of this.items.values()) {
      item.reservedQuantity = 0;
    }
    this.reservations.clear();
  }

  /**
   * Return a snapshot of all inventory items.
   */
  snapshot(): InventoryItem[] {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }
}

/**
 * Attempt to reserve stock across multiple SKUs atomically.
 * If any SKU fails, all already-made reservations in this batch are rolled back.
 * Returns an array of Reservations in the same order as the requests.
 */
export function reserveMultiple(
  store: InventoryStore,
  requests: Array<{ sku: string; quantity: number; options?: ReserveOptions }>
): Reservation[] {
  const made: Reservation[] = [];

  try {
    for (const req of requests) {
      const res = store.reserve(req.sku, req.quantity, req.options ?? {});
      made.push(res);
    }
  } catch (err) {
    for (const res of made) {
      try {
        store.release(res.id);
      } catch {
        // ignore cleanup errors
      }
    }
    throw err;
  }

  return made;
}

/**
 * Transfer a reservation from one SKU to another (cancel + re-reserve).
 * Rolls back if the new reservation fails.
 */
export function transferReservation(
  store: InventoryStore,
  reservationId: string,
  newSku: string,
  options: ReserveOptions = {}
): Reservation {
  const existing = store.getReservation(reservationId);
  if (!existing) throw new ReservationNotFoundError(reservationId);

  store.release(reservationId);

  try {
    return store.reserve(newSku, existing.quantity, options);
  } catch (err) {
    // Restore original reservation as best-effort
    try {
      store.reserve(existing.sku, existing.quantity, {});
    } catch {
      // Cannot restore — stock state may have changed
    }
    throw err;
  }
}