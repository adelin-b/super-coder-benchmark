export interface Reservation {
  id: string
  itemId: string
  quantity: number
}

export class InventoryReservationSystem {
  private inventory: Map<string, number> = new Map()
  private reserved: Map<string, number> = new Map()
  private reservations: Map<string, Reservation> = new Map()
  private nextReservationId: number = 1

  constructor(initialStock?: Record<string, number>) {
    if (initialStock) {
      for (const [itemId, quantity] of Object.entries(initialStock)) {
        if (quantity < 0) throw new Error(`Invalid initial stock for ${itemId}`)
        this.inventory.set(itemId, quantity)
        this.reserved.set(itemId, 0)
      }
    }
  }

  reserve(itemId: string, quantity: number): string {
    if (!this.inventory.has(itemId)) {
      throw new Error(`Item ${itemId} not found`)
    }
    if (quantity <= 0) {
      throw new Error(`Quantity must be positive`)
    }

    const available = this.getAvailable(itemId)
    if (available < quantity) {
      throw new Error(`Insufficient stock for ${itemId}`)
    }

    const reservationId = `RES-${this.nextReservationId++}`
    const reservation: Reservation = { id: reservationId, itemId, quantity }
    this.reservations.set(reservationId, reservation)
    this.reserved.set(itemId, (this.reserved.get(itemId) || 0) + quantity)

    return reservationId
  }

  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`)
    }

    this.reserved.set(
      reservation.itemId,
      (this.reserved.get(reservation.itemId) || 0) - reservation.quantity
    )
    this.reservations.delete(reservationId)
  }

  getAvailable(itemId: string): number {
    if (!this.inventory.has(itemId)) return 0
    return (this.inventory.get(itemId) || 0) - (this.reserved.get(itemId) || 0)
  }

  getReserved(itemId: string): number {
    return this.reserved.get(itemId) || 0
  }

  getTotalStock(itemId: string): number {
    return this.inventory.get(itemId) || 0
  }

  addStock(itemId: string, quantity: number): void {
    if (quantity <= 0) {
      throw new Error(`Quantity must be positive`)
    }
    if (!this.inventory.has(itemId)) {
      this.inventory.set(itemId, 0)
      this.reserved.set(itemId, 0)
    }
    this.inventory.set(itemId, (this.inventory.get(itemId) || 0) + quantity)
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId)
  }
}