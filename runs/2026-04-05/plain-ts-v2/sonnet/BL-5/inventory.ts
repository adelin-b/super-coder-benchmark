// inventory.ts

// ─── Error Classes ────────────────────────────────────────────────────────────

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export class ItemNotFoundError extends InventoryError {
  constructor(public readonly itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(
    public readonly itemId: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `Insufficient stock for item "${itemId}": requested ${requested}, available ${available}`
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationNotFoundError extends InventoryError {
  constructor(public readonly reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

export class InvalidQuantityError extends InventoryError {
  constructor(quantity: number) {
    super(`Quantity must be a positive integer, received: ${quantity}`);
    this.name = "InvalidQuantityError";
  }
}

export class DuplicateItemError extends InventoryError {
  constructor(public readonly itemId: string) {
    super(`Item already exists: ${itemId}`);
    this.name = "DuplicateItemError";
  }
}

export class ReservationAlreadyFinalizedError extends InventoryError {
  constructor(reservationId: string, status: ReservationStatus) {
    super(
      `Reservation "${reservationId}" is already finalized with status: ${status}`
    );
    this.name = "ReservationAlreadyFinalizedError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReservationStatus = "pending" | "committed" | "released" | "expired";

export interface InventoryItem {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface Reservation {
  id: string;
  itemId: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface AvailabilityInfo {
  itemId: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  isAvailable: boolean;
}

export interface ReserveOptions {
  /** Optional TTL in milliseconds. Reservation auto-expires after this duration. */
  ttlMs?: number;
  /** Optional caller-supplied reservation ID (must be unique). */
  reservationId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertPositiveInteger(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidQuantityError(value);
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── InventorySystem ──────────────────────────────────────────────────────────

export class InventorySystem {
  private readonly items = new Map<string, InventoryItem>();
  private readonly reservations = new Map<string, Reservation>();

  // ── Item Management ─────────────────────────────────────────────────────────

  /**
   * Add a new item to the inventory.
   * Throws DuplicateItemError if an item with the same id already exists.
   */
  addItem(id: string, name: string, quantity: number): InventoryItem {
    if (!id || !id.trim()) {
      throw new InventoryError("Item id must be a non-empty string");
    }
    if (!name || !name.trim()) {
      throw new InventoryError("Item name must be a non-empty string");
    }
    assertPositiveInteger(quantity);
    if (this.items.has(id)) {
      throw new DuplicateItemError(id);
    }
    const item: InventoryItem = {
      id,
      name,
      totalQuantity: quantity,
      availableQuantity: quantity,
      reservedQuantity: 0,
    };
    this.items.set(id, item);
    return { ...item };
  }

  /**
   * Restock an existing item by adding more units.
   */
  restock(itemId: string, quantity: number): InventoryItem {
    assertPositiveInteger(quantity);
    const item = this.getItemOrThrow(itemId);
    item.totalQuantity += quantity;
    item.availableQuantity += quantity;
    return { ...item };
  }

  // ── Availability ─────────────────────────────────────────────────────────────

  /**
   * Check the current availability of an item.
   * Lazily expires any pending reservations whose TTL has passed before computing.
   */
  checkAvailability(itemId: string): AvailabilityInfo {
    this.expireStaleReservations(itemId);
    const item = this.getItemOrThrow(itemId);
    return {
      itemId: item.id,
      name: item.name,
      totalQuantity: item.totalQuantity,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      isAvailable: item.availableQuantity > 0,
    };
  }

  /**
   * Returns true only if at least `quantity` units are currently available.
   */
  canReserve(itemId: string, quantity: number): boolean {
    assertPositiveInteger(quantity);
    this.expireStaleReservations(itemId);
    const item = this.getItemOrThrow(itemId);
    return item.availableQuantity >= quantity;
  }

  // ── Reservation ──────────────────────────────────────────────────────────────

  /**
   * Reserve `quantity` units of an item.
   * Succeeds atomically: either the full amount is reserved or an error is thrown.
   * Throws InsufficientStockError if not enough units are available.
   */
  reserve(
    itemId: string,
    quantity: number,
    options: ReserveOptions = {}
  ): Reservation {
    assertPositiveInteger(quantity);
    this.expireStaleReservations(itemId);
    const item = this.getItemOrThrow(itemId);

    if (item.availableQuantity < quantity) {
      throw new InsufficientStockError(itemId, quantity, item.availableQuantity);
    }

    const reservationId = options.reservationId ?? generateId();
    if (this.reservations.has(reservationId)) {
      throw new InventoryError(`Reservation ID already in use: ${reservationId}`);
    }

    const now = new Date();
    const expiresAt =
      options.ttlMs != null && options.ttlMs > 0
        ? new Date(now.getTime() + options.ttlMs)
        : null;

    // Atomically update stock
    item.availableQuantity -= quantity;
    item.reservedQuantity += quantity;

    const reservation: Reservation = {
      id: reservationId,
      itemId,
      quantity,
      status: "pending",
      createdAt: now,
      expiresAt,
    };
    this.reservations.set(reservationId, reservation);
    return { ...reservation };
  }

  /**
   * Commit a pending reservation, permanently deducting it from total stock.
   * A committed reservation cannot be released back to available stock.
   */
  commit(reservationId: string): Reservation {
    const reservation = this.getReservationOrThrow(reservationId);
    this.assertPending(reservation);

    const item = this.getItemOrThrow(reservation.itemId);
    item.reservedQuantity -= reservation.quantity;
    item.totalQuantity -= reservation.quantity;

    reservation.status = "committed";
    return { ...reservation };
  }

  /**
   * Release a pending reservation, returning the stock to available.
   */
  release(reservationId: string): Reservation {
    const reservation = this.getReservationOrThrow(reservationId);
    this.assertPending(reservation);

    const item = this.getItemOrThrow(reservation.itemId);
    item.availableQuantity += reservation.quantity;
    item.reservedQuantity -= reservation.quantity;

    reservation.status = "released";
    return { ...reservation };
  }

  /**
   * Retrieve a reservation by ID.
   * Checks expiry before returning.
   */
  getReservation(reservationId: string): Reservation {
    this.tryExpireReservation(reservationId);
    return { ...this.getReservationOrThrow(reservationId) };
  }

  // ── Batch / Concurrent-style Operations ─────────────────────────────────────

  /**
   * Reserve multiple items in a single atomic-style operation.
   * If ANY item cannot be reserved the entire batch is rolled back.
   */
  reserveBatch(
    requests: Array<{ itemId: string; quantity: number }>,
    options: ReserveOptions = {}
  ): Reservation[] {
    if (requests.length === 0) {
      return [];
    }

    // Validate all requests up front
    for (const req of requests) {
      assertPositiveInteger(req.quantity);
      this.expireStaleReservations(req.itemId);
      this.getItemOrThrow(req.itemId); // existence check
    }

    // Pre-flight availability check (no mutation yet)
    const tentative = new Map<string, number>();
    for (const req of requests) {
      const item = this.items.get(req.itemId)!;
      const alreadyTentativelyReserved = tentative.get(req.itemId) ?? 0;
      const effectiveAvailable =
        item.availableQuantity - alreadyTentativelyReserved;
      if (effectiveAvailable < req.quantity) {
        throw new InsufficientStockError(
          req.itemId,
          req.quantity,
          effectiveAvailable
        );
      }
      tentative.set(req.itemId, alreadyTentativelyReserved + req.quantity);
    }

    // All checks passed — perform reservations
    const created: Reservation[] = [];
    try {
      for (const req of requests) {
        // Each reserve call uses the shared options but generates its own ID
        const individualOptions: ReserveOptions = {
          ttlMs: options.ttlMs,
          // Do not pass reservationId so each gets a unique generated ID
        };
        created.push(this.reserve(req.itemId, req.quantity, individualOptions));
      }
    } catch (err) {
      // Roll back any reservations already created in this batch
      for (const res of created) {
        try {
          this.release(res.id);
        } catch {
          // ignore rollback errors
        }
      }
      throw err;
    }

    return created;
  }

  /**
   * Release all pending reservations for a given item.
   */
  releaseAllForItem(itemId: string): Reservation[] {
    this.getItemOrThrow(itemId);
    const released: Reservation[] = [];
    for (const reservation of this.reservations.values()) {
      if (reservation.itemId === itemId && reservation.status === "pending") {
        released.push(this.release(reservation.id));
      }
    }
    return released;
  }

  // ── Introspection ─────────────────────────────────────────────────────────────

  /**
   * List all items currently tracked by the system.
   */
  listItems(): InventoryItem[] {
    return Array.from(this.items.values()).map((i) => ({ ...i }));
  }

  /**
   * List all reservations, optionally filtered by status.
   */
  listReservations(filterStatus?: ReservationStatus): Reservation[] {
    return Array.from(this.reservations.values())
      .filter((r) => (filterStatus == null ? true : r.status === filterStatus))
      .map((r) => ({ ...r }));
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  private getItemOrThrow(itemId: string): InventoryItem {
    const item = this.items.get(itemId);
    if (!item) throw new ItemNotFoundError(itemId);
    return item;
  }

  private getReservationOrThrow(reservationId: string): Reservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);
    return reservation;
  }

  private assertPending(reservation: Reservation): void {
    if (reservation.status !== "pending") {
      throw new ReservationAlreadyFinalizedError(
        reservation.id,
        reservation.status
      );
    }
  }

  private tryExpireReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) return;
    if (
      reservation.status === "pending" &&
      reservation.expiresAt !== null &&
      new Date() >= reservation.expiresAt
    ) {
      this.release(reservationId);
      reservation.status = "expired";
      const item = this.items.get(reservation.itemId);
      // release() already returned stock; mark status as expired retroactively
      if (item) {
        // The release call set status to "released"; override to "expired"
        reservation.status = "expired";
      }
    }
  }

  private expireStaleReservations(itemId: string): void {
    for (const reservation of this.reservations.values()) {
      if (reservation.itemId === itemId) {
        this.tryExpireReservation(reservation.id);
      }
    }
  }
}