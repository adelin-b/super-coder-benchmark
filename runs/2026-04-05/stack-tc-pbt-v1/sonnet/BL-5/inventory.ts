import { randomUUID } from "crypto"

// ─── Types & Errors ──────────────────────────────────────────────────────────

export type ReservationStatus = "active" | "released" | "expired"

export interface InventoryItem {
  sku: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
}

export interface Reservation {
  id: string
  sku: string
  quantity: number
  status: ReservationStatus
  createdAt: Date
  expiresAt: Date | null
  releasedAt: Date | null
}

export interface ReserveOptions {
  ttlMs?: number // time-to-live in milliseconds; null = no expiry
}

export interface ReleaseResult {
  released: boolean
  reservation: Reservation
}

export interface AvailabilityResult {
  sku: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  canFulfill: (qty: number) => boolean
}

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = "InventoryError"
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `Insufficient stock for SKU "${sku}": requested ${requested}, available ${available}`,
      "INSUFFICIENT_STOCK"
    )
    this.name = "InsufficientStockError"
  }
}

export class SkuNotFoundError extends InventoryError {
  constructor(public readonly sku: string) {
    super(`SKU "${sku}" not found in inventory`, "SKU_NOT_FOUND")
    this.name = "SkuNotFoundError"
  }
}

export class ReservationNotFoundError extends InventoryError {
  constructor(public readonly reservationId: string) {
    super(`Reservation "${reservationId}" not found`, "RESERVATION_NOT_FOUND")
    this.name = "ReservationNotFoundError"
  }
}

export class InvalidQuantityError extends InventoryError {
  constructor(quantity: number) {
    super(`Quantity must be a positive integer, got ${quantity}`, "INVALID_QUANTITY")
    this.name = "InvalidQuantityError"
  }
}

// ─── Internal State ───────────────────────────────────────────────────────────

interface InternalItem {
  sku: string
  totalQuantity: number
  reservedQuantity: number
}

interface InternalReservation {
  id: string
  sku: string
  quantity: number
  status: ReservationStatus
  createdAt: Date
  expiresAt: Date | null
  releasedAt: Date | null
}

// ─── Inventory Store ──────────────────────────────────────────────────────────

export class InventoryStore {
  private items = new Map<string, InternalItem>()
  private reservations = new Map<string, InternalReservation>()
  private expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // ── Stock management ────────────────────────────────────────────────────────

  /**
   * Add a new SKU or increase the total quantity of an existing one.
   * Quantity must be a positive integer.
   */
  addStock(sku: string, quantity: number): InventoryItem {
    validateSku(sku)
    validateQuantity(quantity)

    const existing = this.items.get(sku)
    if (existing) {
      existing.totalQuantity += quantity
    } else {
      this.items.set(sku, { sku, totalQuantity: quantity, reservedQuantity: 0 })
    }

    return this.buildItem(this.items.get(sku)!)
  }

  /**
   * Remove stock from total. Cannot remove more than is currently available
   * (i.e. total minus reserved).
   */
  removeStock(sku: string, quantity: number): InventoryItem {
    validateSku(sku)
    validateQuantity(quantity)

    const item = this.requireItem(sku)
    const available = item.totalQuantity - item.reservedQuantity

    if (quantity > available) {
      throw new InsufficientStockError(sku, quantity, available)
    }

    item.totalQuantity -= quantity
    return this.buildItem(item)
  }

  /**
   * Completely remove a SKU. Fails if there are active reservations.
   */
  removeSku(sku: string): void {
    validateSku(sku)
    const item = this.requireItem(sku)

    if (item.reservedQuantity > 0) {
      throw new InventoryError(
        `Cannot remove SKU "${sku}" while ${item.reservedQuantity} units are reserved`,
        "SKU_HAS_ACTIVE_RESERVATIONS"
      )
    }

    this.items.delete(sku)
  }

  // ── Availability ────────────────────────────────────────────────────────────

  /**
   * Check availability for a given SKU.
   * Expired reservations are purged before calculating.
   */
  checkAvailability(sku: string): AvailabilityResult {
    validateSku(sku)
    this.purgeExpired(sku)
    const item = this.requireItem(sku)
    return this.buildAvailability(item)
  }

  /**
   * Check availability for all SKUs.
   */
  checkAllAvailability(): AvailabilityResult[] {
    for (const sku of this.items.keys()) {
      this.purgeExpired(sku)
    }
    return Array.from(this.items.values()).map((item) => this.buildAvailability(item))
  }

  /**
   * Returns true when the requested quantity can be reserved right now.
   */
  canReserve(sku: string, quantity: number): boolean {
    validateSku(sku)
    validateQuantity(quantity)

    try {
      this.purgeExpired(sku)
      const item = this.requireItem(sku)
      return item.totalQuantity - item.reservedQuantity >= quantity
    } catch {
      return false
    }
  }

  // ── Reservation ─────────────────────────────────────────────────────────────

  /**
   * Reserve stock for a given SKU.
   * Throws InsufficientStockError when not enough units are available.
   * Optionally accepts a TTL (in ms) after which the reservation auto-expires.
   */
  reserve(sku: string, quantity: number, options: ReserveOptions = {}): Reservation {
    validateSku(sku)
    validateQuantity(quantity)

    this.purgeExpired(sku)
    const item = this.requireItem(sku)
    const available = item.totalQuantity - item.reservedQuantity

    if (quantity > available) {
      throw new InsufficientStockError(sku, quantity, available)
    }

    const now = new Date()
    const expiresAt =
      options.ttlMs != null && options.ttlMs > 0
        ? new Date(now.getTime() + options.ttlMs)
        : null

    const reservation: InternalReservation = {
      id: randomUUID(),
      sku,
      quantity,
      status: "active",
      createdAt: now,
      expiresAt,
      releasedAt: null,
    }

    item.reservedQuantity += quantity
    this.reservations.set(reservation.id, reservation)

    if (expiresAt) {
      this.scheduleExpiry(reservation.id, options.ttlMs!)
    }

    return this.buildReservation(reservation)
  }

  /**
   * Release a reservation by ID, freeing the reserved stock.
   * Idempotent: releasing an already-released reservation returns gracefully.
   */
  release(reservationId: string): ReleaseResult {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId)
    }

    if (reservation.status !== "active") {
      // already released or expired — idempotent
      return { released: false, reservation: this.buildReservation(reservation) }
    }

    reservation.status = "released"
    reservation.releasedAt = new Date()

    const item = this.items.get(reservation.sku)
    if (item) {
      item.reservedQuantity = Math.max(0, item.reservedQuantity - reservation.quantity)
    }

    this.cancelExpiry(reservationId)

    return { released: true, reservation: this.buildReservation(reservation) }
  }

  /**
   * Extend the TTL of an active reservation.
   */
  extendReservation(reservationId: string, additionalMs: number): Reservation {
    if (!Number.isInteger(additionalMs) || additionalMs <= 0) {
      throw new InventoryError(
        `additionalMs must be a positive integer, got ${additionalMs}`,
        "INVALID_TTL"
      )
    }

    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId)
    }

    if (reservation.status !== "active") {
      throw new InventoryError(
        `Cannot extend a reservation with status "${reservation.status}"`,
        "RESERVATION_NOT_ACTIVE"
      )
    }

    const base = reservation.expiresAt ?? new Date()
    reservation.expiresAt = new Date(base.getTime() + additionalMs)

    this.cancelExpiry(reservationId)
    const remaining = reservation.expiresAt.getTime() - Date.now()
    if (remaining > 0) {
      this.scheduleExpiry(reservationId, remaining)
    } else {
      this.expireReservation(reservationId)
    }

    return this.buildReservation(reservation)
  }

  /**
   * Get a single reservation by ID.
   */
  getReservation(reservationId: string): Reservation {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId)
    }
    return this.buildReservation(reservation)
  }

  /**
   * List all reservations, optionally filtered by SKU and/or status.
   */
  listReservations(filters?: {
    sku?: string
    status?: ReservationStatus
  }): Reservation[] {
    let results = Array.from(this.reservations.values())

    if (filters?.sku) {
      results = results.filter((r) => r.sku === filters.sku)
    }
    if (filters?.status) {
      results = results.filter((r) => r.status === filters.status)
    }

    return results.map((r) => this.buildReservation(r))
  }

  /**
   * Get a snapshot of a specific item (without purging expiry).
   */
  getItem(sku: string): InventoryItem {
    validateSku(sku)
    return this.buildItem(this.requireItem(sku))
  }

  /**
   * List all items.
   */
  listItems(): InventoryItem[] {
    return Array.from(this.items.values()).map((item) => this.buildItem(item))
  }

  /**
   * Atomically reserve across multiple SKUs.
   * All-or-nothing: if any SKU cannot be reserved, no stock is touched.
   */
  reserveMultiple(
    requests: Array<{ sku: string; quantity: number }>,
    options: ReserveOptions = {}
  ): Reservation[] {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new InventoryError("requests must be a non-empty array", "INVALID_REQUESTS")
    }

    // Validate and check availability for all first (no side effects yet)
    for (const req of requests) {
      validateSku(req.sku)
      validateQuantity(req.quantity)
      this.purgeExpired(req.sku)
      const item = this.requireItem(req.sku)
      const available = item.totalQuantity - item.reservedQuantity
      if (req.quantity > available) {
        throw new InsufficientStockError(req.sku, req.quantity, available)
      }
    }

    // Commit all reservations
    return requests.map((req) => this.reserve(req.sku, req.quantity, options))
  }

  /**
   * Release multiple reservations atomically (best-effort: all succeed or throws
   * on first unknown ID).
   */
  releaseMultiple(reservationIds: string[]): ReleaseResult[] {
    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      throw new InventoryError(
        "reservationIds must be a non-empty array",
        "INVALID_RESERVATION_IDS"
      )
    }

    // Validate all exist first
    for (const id of reservationIds) {
      if (!this.reservations.has(id)) {
        throw new ReservationNotFoundError(id)
      }
    }

    return reservationIds.map((id) => this.release(id))
  }

  /**
   * Purge all expired reservations across every SKU.
   */
  purgeAllExpired(): number {
    let count = 0
    const now = new Date()
    for (const [id, res] of this.reservations) {
      if (res.status === "active" && res.expiresAt && res.expiresAt <= now) {
        this.expireReservation(id)
        count++
      }
    }
    return count
  }

  /**
   * Destroy all state (useful for testing).
   */
  clear(): void {
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer)
    }
    this.expiryTimers.clear()
    this.reservations.clear()
    this.items.clear()
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private requireItem(sku: string): InternalItem {
    const item = this.items.get(sku)
    if (!item) throw new SkuNotFoundError(sku)
    return item
  }

  private buildItem(item: InternalItem): InventoryItem {
    return {
      sku: item.sku,
      totalQuantity: item.totalQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.totalQuantity - item.reservedQuantity,
    }
  }

  private buildAvailability(item: InternalItem): AvailabilityResult {
    const available = item.totalQuantity - item.reservedQuantity
    return {
      sku: item.sku,
      totalQuantity: item.totalQuantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: available,
      canFulfill: (qty: number) => qty > 0 && Number.isInteger(qty) && qty <= available,
    }
  }

  private buildReservation(r: InternalReservation): Reservation {
    return {
      id: r.id,
      sku: r.sku,
      quantity: r.quantity,
      status: r.status,
      createdAt: new Date(r.createdAt),
      expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
      releasedAt: r.releasedAt ? new Date(r.releasedAt) : null,
    }
  }

  private scheduleExpiry(reservationId: string, ttlMs: number): void {
    const timer = setTimeout(() => {
      this.expireReservation(reservationId)
    }, ttlMs)

    // Allow Node.js to exit even with pending timers
    if (typeof timer === "object" && "unref" in timer) {
      ;(timer as NodeJS.Timeout).unref()
    }

    this.expiryTimers.set(reservationId, timer)
  }

  private cancelExpiry(reservationId: string): void {
    const timer = this.expiryTimers.get(reservationId)
    if (timer != null) {
      clearTimeout(timer)
      this.expiryTimers.delete(reservationId)
    }
  }

  private expireReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId)
    if (!reservation || reservation.status !== "active") return

    reservation.status = "expired"
    reservation.releasedAt = new Date()

    const item = this.items.get(reservation.sku)
    if (item) {
      item.reservedQuantity = Math.max(0, item.reservedQuantity - reservation.quantity)
    }

    this.expiryTimers.delete(reservationId)
  }

  private purgeExpired(sku: string): void {
    const now = new Date()
    for (const [id, res] of this.reservations) {
      if (
        res.sku === sku &&
        res.status === "active" &&
        res.expiresAt &&
        res.expiresAt <= now
      ) {
        this.expireReservation(id)
      }
    }
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateSku(sku: unknown): asserts sku is string {
  if (typeof sku !== "string" || sku.trim().length === 0) {
    throw new InventoryError(
      `SKU must be a non-empty string, got ${JSON.stringify(sku)}`,
      "INVALID_SKU"
    )
  }
}

function validateQuantity(quantity: unknown): asserts quantity is number {
  if (!Number.isInteger(quantity) || (quantity as number) <= 0) {
    throw new InvalidQuantityError(quantity as number)
  }
}

// ─── Default singleton export ─────────────────────────────────────────────────

export const defaultStore = new InventoryStore()