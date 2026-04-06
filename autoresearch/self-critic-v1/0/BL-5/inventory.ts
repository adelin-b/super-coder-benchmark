export interface Reservation {
  id: string
  productId: string
  quantity: number
  timestamp: number
}

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientStockError'
    Object.setPrototypeOf(this, InsufficientStockError.prototype)
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReservationNotFoundError'
    Object.setPrototypeOf(this, ReservationNotFoundError.prototype)
  }
}

export class InventoryReservationSystem {
  private stock: Map<string, number> = new Map()
  private reservations: Map<string, Reservation> = new Map()
  private reservationIdCounter = 0
  private operationQueue: Promise<void> = Promise.resolve()

  addStock(productId: string, quantity: number): void {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative')
    }
    const current = this.stock.get(productId) || 0
    this.stock.set(productId, current + quantity)
  }

  async reserve(productId: string, quantity: number): Promise<string> {
    return this.executeSerially(async () => {
      if (quantity <= 0) {
        throw new Error('Reservation quantity must be positive')
      }
      
      const available = this.stock.get(productId) || 0
      if (available < quantity) {
        throw new InsufficientStockError(
          `Insufficient stock for product ${productId}: required ${quantity}, available ${available}`
        )
      }

      this.stock.set(productId, available - quantity)
      const reservationId = `RES_${++this.reservationIdCounter}`
      const reservation: Reservation = {
        id: reservationId,
        productId,
        quantity,
        timestamp: Date.now()
      }
      this.reservations.set(reservationId, reservation)
      return reservationId
    })
  }

  async release(reservationId: string): Promise<void> {
    return this.executeSerially(async () => {
      const reservation = this.reservations.get(reservationId)
      if (!reservation) {
        throw new ReservationNotFoundError(
          `Reservation ${reservationId} not found`
        )
      }

      const { productId, quantity } = reservation
      const current = this.stock.get(productId) || 0
      this.stock.set(productId, current + quantity)
      this.reservations.delete(reservationId)
    })
  }

  checkAvailability(productId: string, quantity: number): boolean {
    const available = this.stock.get(productId) || 0
    return available >= quantity
  }

  getAvailableStock(productId: string): number {
    return this.stock.get(productId) || 0
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId)
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values())
  }

  getReservationsByProduct(productId: string): Reservation[] {
    return Array.from(this.reservations.values()).filter(
      (r) => r.productId === productId
    )
  }

  private executeSerially<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.operationQueue.then(fn)
    this.operationQueue = task.then(
      () => {},
      () => {}
    )
    return task
  }
}