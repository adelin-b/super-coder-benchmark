export class InventoryReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryReservationError';
  }
}

export interface IInventory {
  reserve(quantity: number): void;
  release(quantity: number): void;
  getAvailable(): number;
  getReserved(): number;
  getTotal(): number;
  commit(): void;
  rollback(): void;
}

export class InventoryReservation implements IInventory {
  private available: number;
  private reserved: number;
  private pendingOperations: Array<{ type: 'reserve' | 'release'; quantity: number }> = [];

  constructor(initialStock: number) {
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      throw new InventoryReservationError('Initial stock must be a non-negative integer');
    }
    this.available = initialStock;
    this.reserved = 0;
  }

  reserve(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InventoryReservationError('Reservation quantity must be a non-negative integer');
    }
    if (quantity > this.available) {
      throw new InventoryReservationError('Insufficient available stock to reserve');
    }
    this.available -= quantity;
    this.reserved += quantity;
    this.pendingOperations.push({ type: 'reserve', quantity });
  }

  release(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InventoryReservationError('Release quantity must be a non-negative integer');
    }
    if (quantity > this.reserved) {
      throw new InventoryReservationError('Cannot release more than currently reserved');
    }
    this.available += quantity;
    this.reserved -= quantity;
    this.pendingOperations.push({ type: 'release', quantity });
  }

  getAvailable(): number {
    return this.available;
  }

  getReserved(): number {
    return this.reserved;
  }

  getTotal(): number {
    return this.available + this.reserved;
  }

  commit(): void {
    this.pendingOperations = [];
  }

  rollback(): void {
    for (let i = this.pendingOperations.length - 1; i >= 0; i--) {
      const op = this.pendingOperations[i];
      if (op.type === 'reserve') {
        this.available += op.quantity;
        this.reserved -= op.quantity;
      } else {
        this.available -= op.quantity;
        this.reserved += op.quantity;
      }
    }
    this.pendingOperations = [];
  }
}

export function createInventory(initialStock: number): IInventory {
  return new InventoryReservation(initialStock);
}