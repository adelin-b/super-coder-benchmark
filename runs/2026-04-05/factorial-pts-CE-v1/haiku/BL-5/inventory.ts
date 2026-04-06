export interface Reservation {
  id: string;
  inventoryId: string;
  quantity: number;
  createdAt: Date;
}

export class Inventory {
  private id: string;
  private sku: string;
  private totalQuantity: number;
  private reservedQuantity: number;
  private reservations: Map<string, Reservation>;
  private lock: Promise<void> = Promise.resolve();

  constructor(id: string, sku: string, quantity: number) {
    this.id = id;
    this.sku = sku;
    this.totalQuantity = quantity;
    this.reservedQuantity = 0;
    this.reservations = new Map();
  }

  getId(): string {
    return this.id;
  }

  getSku(): string {
    return this.sku;
  }

  async reserve(quantity: number): Promise<Reservation> {
    return new Promise((resolve, reject) => {
      this.lock = this.lock.then(() => {
        const available = this.totalQuantity - this.reservedQuantity;
        if (quantity <= 0) {
          reject(new Error('Quantity must be greater than 0'));
          return;
        }
        if (quantity > available) {
          reject(
            new Error(
              `Insufficient stock. Available: ${available}, Requested: ${quantity}`
            )
          );
          return;
        }

        const reservationId = `RES-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}`;
        const reservation: Reservation = {
          id: reservationId,
          inventoryId: this.id,
          quantity,
          createdAt: new Date(),
        };

        this.reservations.set(reservationId, reservation);
        this.reservedQuantity += quantity;

        resolve(reservation);
      });
    });
  }

  async release(reservationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.lock = this.lock.then(() => {
        const reservation = this.reservations.get(reservationId);
        if (!reservation) {
          reject(new Error(`Reservation not found: ${reservationId}`));
          return;
        }

        this.reservedQuantity -= reservation.quantity;
        this.reservations.delete(reservationId);

        resolve();
      });
    });
  }

  async getAvailability(): Promise<number> {
    return new Promise((resolve) => {
      this.lock = this.lock.then(() => {
        resolve(this.totalQuantity - this.reservedQuantity);
      });
    });
  }

  getAvailabilitySync(): number {
    return this.totalQuantity - this.reservedQuantity;
  }

  getReserved(): number {
    return this.reservedQuantity;
  }

  getTotal(): number {
    return this.totalQuantity;
  }
}

export class InventoryManager {
  private inventories: Map<string, Inventory>;

  constructor() {
    this.inventories = new Map();
  }

  createInventory(sku: string, quantity: number): Inventory {
    if (quantity < 0) {
      throw new Error('Initial quantity cannot be negative');
    }
    const id = `INV-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const inventory = new Inventory(id, sku, quantity);
    this.inventories.set(id, inventory);
    return inventory;
  }

  getInventory(id: string): Inventory {
    const inventory = this.inventories.get(id);
    if (!inventory) {
      throw new Error(`Inventory not found: ${id}`);
    }
    return inventory;
  }

  async reserve(inventoryId: string, quantity: number): Promise<Reservation> {
    const inventory = this.getInventory(inventoryId);
    return inventory.reserve(quantity);
  }

  async release(inventoryId: string, reservationId: string): Promise<void> {
    const inventory = this.getInventory(inventoryId);
    return inventory.release(reservationId);
  }

  async getAvailability(inventoryId: string): Promise<number> {
    const inventory = this.getInventory(inventoryId);
    return inventory.getAvailability();
  }
}