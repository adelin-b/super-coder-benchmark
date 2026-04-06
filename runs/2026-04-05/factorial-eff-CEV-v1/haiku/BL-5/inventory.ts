interface Reservation {
  id: string
  itemId: string
  quantity: number
  timestamp: number
}

class InventoryReservationSystem {
  private inventory: Map<string, number> = new Map()
  private reservations: Map<string, Reservation> = new Map()
  private reservationCounter: number = 0

  reserve(itemId: string, quantity: number): string {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      throw new Error('itemId must be a non-empty string')
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('quantity must be a positive integer')
    }

    const available = this.inventory.get(itemId) ?? 0
    if (available < quantity) {
      throw new Error(
        `Insufficient inventory for item ${itemId}: ${available} available, ${quantity} requested`
      )
    }

    this.inventory.set(itemId, available - quantity)

    const reservationId = `RES-${++this.reservationCounter}`
    const reservation: Reservation = {
      id: reservationId,
      itemId,
      quantity,
      timestamp: Date.now(),
    }
    this.reservations.set(reservationId, reservation)

    return reservationId
  }

  release(reservationId: string): void {
    if (typeof reservationId !== 'string' || !reservationId.trim()) {
      throw new Error('reservationId must be a non-empty string')
    }

    const reservation = this.reservations.get(reservationId)
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`)
    }

    const current = this.inventory.get(reservation.itemId) ?? 0
    this.inventory.set(reservation.itemId, current + reservation.quantity)

    this.reservations.delete(reservationId)
  }

  checkAvailability(itemId: string): number {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      throw new Error('itemId must be a non-empty string')
    }

    return this.inventory.get(itemId) ?? 0
  }

  addStock(itemId: string, quantity: number): void {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      throw new Error('itemId must be a non-empty string')
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('quantity must be a positive integer')
    }

    const current = this.inventory.get(itemId) ?? 0
    this.inventory.set(itemId, current + quantity)
  }

  getReservation(reservationId: string): Reservation | null {
    if (typeof reservationId !== 'string' || !reservationId.trim()) {
      throw new Error('reservationId must be a non-empty string')
    }
    return this.reservations.get(reservationId) ?? null
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values())
  }
}

export { InventoryReservationSystem }
export type { Reservation }