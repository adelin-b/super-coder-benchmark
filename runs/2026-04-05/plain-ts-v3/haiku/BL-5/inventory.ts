export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export interface Product {
  id: string;
  name: string;
  totalStock: number;
  reservedStock: number;
}

export interface Reservation {
  id: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  released: boolean;
}

export class InventoryManager {
  private products: Map<string, Product> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private reservationCounter: number = 0;

  addProduct(id: string, name: string, totalStock: number): Product {
    if (!id || !name) {
      throw new InventoryError('Product ID and name are required');
    }
    if (totalStock < 0) {
      throw new InventoryError('Total stock cannot be negative');
    }

    const product: Product = {
      id,
      name,
      totalStock,
      reservedStock: 0,
    };
    this.products.set(id, product);
    return product;
  }

  reserve(productId: string, quantity: number): string {
    if (!productId) {
      throw new InventoryError('Product ID is required');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InventoryError('Quantity must be a positive integer');
    }

    const product = this.products.get(productId);
    if (!product) {
      throw new InventoryError(`Product not found: ${productId}`);
    }

    const available = product.totalStock - product.reservedStock;
    if (available < quantity) {
      throw new InventoryError(
        `Insufficient stock for ${productId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    product.reservedStock += quantity;

    const reservationId = `RES_${++this.reservationCounter}`;
    const reservation: Reservation = {
      id: reservationId,
      productId,
      quantity,
      createdAt: new Date(),
      released: false,
    };
    this.reservations.set(reservationId, reservation);

    return reservationId;
  }

  release(reservationId: string): void {
    if (!reservationId) {
      throw new InventoryError('Reservation ID is required');
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new InventoryError(`Reservation not found: ${reservationId}`);
    }

    if (reservation.released) {
      throw new InventoryError(`Reservation already released: ${reservationId}`);
    }

    const product = this.products.get(reservation.productId);
    if (!product) {
      throw new InventoryError(`Product not found: ${reservation.productId}`);
    }

    product.reservedStock -= reservation.quantity;
    reservation.released = true;
  }

  checkAvailability(productId: string): number {
    if (!productId) {
      throw new InventoryError('Product ID is required');
    }

    const product = this.products.get(productId);
    if (!product) {
      throw new InventoryError(`Product not found: ${productId}`);
    }

    return product.totalStock - product.reservedStock;
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }
}

export function createInventoryManager(): InventoryManager {
  return new InventoryManager();
}