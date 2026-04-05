export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class InvalidReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReservationError';
  }
}

export class InventoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryNotFoundError';
  }
}

export interface Reservation {
  id: string;
  inventoryId: string;
  quantity: number;
  createdAt: Date;
}

export interface InventoryItem {
  id: string;
  name: string;
  totalStock: number;
  reservedStock: number;
}

export class Inventory {
  private id: string;
  private name: string;
  private totalStock: number;
  private reservedStock: number;
  private reservations: Map<string, Reservation>;

  constructor(id: string, name: string, totalStock: number) {
    if (totalStock < 0) {
      throw new Error('Total stock cannot be negative');
    }
    this.id = id;
    this.name = name;
    this.totalStock = totalStock;
    this.reservedStock = 0;
    this.reservations = new Map();
  }

  reserve(reservationId: string, quantity: number): Reservation {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be positive');
    }

    if (this.reservations.has(reservationId)) {
      throw new InvalidReservationError(
        `Reservation with id ${reservationId} already exists`
      );
    }

    const availableStock = this.totalStock - this.reservedStock;
    if (quantity > availableStock) {
      throw new InsufficientStockError(
        `Insufficient stock: requested ${quantity}, available ${availableStock}`
      );
    }

    const reservation: Reservation = {
      id: reservationId,
      inventoryId: this.id,
      quantity,
      createdAt: new Date(),
    };

    this.reservations.set(reservationId, reservation);
    this.reservedStock += quantity;

    return reservation;
  }

  release(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new InvalidReservationError(
        `Reservation with id ${reservationId} not found`
      );
    }

    this.reservedStock -= reservation.quantity;
    this.reservations.delete(reservationId);
  }

  checkAvailability(): number {
    return this.totalStock - this.reservedStock;
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }

  getAllReservations(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  getInfo(): InventoryItem {
    return {
      id: this.id,
      name: this.name,
      totalStock: this.totalStock,
      reservedStock: this.reservedStock,
    };
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getTotalStock(): number {
    return this.totalStock;
  }

  getReservedStock(): number {
    return this.reservedStock;
  }
}

export class InventoryManager {
  private inventories: Map<string, Inventory>;
  private reservationMap: Map<string, string>; // maps reservationId to inventoryId

  constructor() {
    this.inventories = new Map();
    this.reservationMap = new Map();
  }

  addInventory(id: string, name: string, totalStock: number): Inventory {
    if (this.inventories.has(id)) {
      throw new Error(`Inventory with id ${id} already exists`);
    }

    const inventory = new Inventory(id, name, totalStock);
    this.inventories.set(id, inventory);
    return inventory;
  }

  reserve(
    inventoryId: string,
    reservationId: string,
    quantity: number
  ): Reservation {
    const inventory = this.inventories.get(inventoryId);
    if (!inventory) {
      throw new InventoryNotFoundError(
        `Inventory with id ${inventoryId} not found`
      );
    }

    if (this.reservationMap.has(reservationId)) {
      throw new InvalidReservationError(
        `Reservation with id ${reservationId} already exists`
      );
    }

    try {
      const reservation = inventory.reserve(reservationId, quantity);
      this.reservationMap.set(reservationId, inventoryId);
      return reservation;
    } catch (error) {
      if (error instanceof InvalidReservationError) {
        throw error;
      }
      if (error instanceof InsufficientStockError) {
        throw error;
      }
      throw error;
    }
  }

  release(reservationId: string): void {
    const inventoryId = this.reservationMap.get(reservationId);
    if (!inventoryId) {
      throw new InvalidReservationError(
        `Reservation with id ${reservationId} not found`
      );
    }

    const inventory = this.inventories.get(inventoryId);
    if (!inventory) {
      throw new InventoryNotFoundError(
        `Inventory with id ${inventoryId} not found`
      );
    }

    inventory.release(reservationId);
    this.reservationMap.delete(reservationId);
  }

  checkAvailability(inventoryId: string): number {
    const inventory = this.inventories.get(inventoryId);
    if (!inventory) {
      throw new InventoryNotFoundError(
        `Inventory with id ${inventoryId} not found`
      );
    }

    return inventory.checkAvailability();
  }

  getInventory(inventoryId: string): Inventory | undefined {
    return this.inventories.get(inventoryId);
  }

  getAllInventories(): Inventory[] {
    return Array.from(this.inventories.values());
  }

  getReservation(reservationId: string): Reservation | undefined {
    const inventoryId = this.reservationMap.get(reservationId);
    if (!inventoryId) {
      return undefined;
    }

    const inventory = this.inventories.get(inventoryId);
    if (!inventory) {
      return undefined;
    }

    return inventory.getReservation(reservationId);
  }

  removeInventory(inventoryId: string): boolean {
    const inventory = this.inventories.get(inventoryId);
    if (!inventory) {
      return false;
    }

    const reservations = inventory.getAllReservations();
    for (const reservation of reservations) {
      this.reservationMap.delete(reservation.id);
    }

    return this.inventories.delete(inventoryId);
  }
}