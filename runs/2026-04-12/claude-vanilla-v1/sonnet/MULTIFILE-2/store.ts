// ── Projection Store ────────────────────────────────────────────────────────

export interface UserProjection {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrderProjection {
  id: string;
  userId: string;
  items: Array<{ sku: string; quantity: number; price: number }>;
  total: number;
  status: 'placed' | 'shipped';
  placedAt: number;
  shippedAt: number | null;
}

export interface FulfillmentProjection {
  orderId: string;
  status: 'pending' | 'processing' | 'shipped' | 'failed';
  paymentProcessed: boolean;
  inventoryReserved: boolean;
  startedAt: number | null;
  completedAt: number | null;
  failureReason: string | null;
}

export function createProjectionStore(): {
  // User projections
  upsertUser(user: UserProjection): void;
  getUser(id: string): UserProjection | null;
  getAllUsers(): UserProjection[];

  // Order projections
  upsertOrder(order: OrderProjection): void;
  getOrder(id: string): OrderProjection | null;
  getAllOrders(): OrderProjection[];
  updateOrderStatus(id: string, status: 'placed' | 'shipped', shippedAt?: number): void;

  // Fulfillment projections
  upsertFulfillment(fulfillment: FulfillmentProjection): void;
  getFulfillment(orderId: string): FulfillmentProjection | null;
  getAllFulfillments(): FulfillmentProjection[];
  updateFulfillment(orderId: string, updates: Partial<FulfillmentProjection>): void;
} {
  const users = new Map<string, UserProjection>();
  const orders = new Map<string, OrderProjection>();
  const fulfillments = new Map<string, FulfillmentProjection>();

  return {
    // ── User methods ──────────────────────────────────────────────────────
    upsertUser(user: UserProjection): void {
      users.set(user.id, { ...user });
    },

    getUser(id: string): UserProjection | null {
      const u = users.get(id);
      return u ? { ...u } : null;
    },

    getAllUsers(): UserProjection[] {
      return Array.from(users.values()).map(u => ({ ...u }));
    },

    // ── Order methods ─────────────────────────────────────────────────────
    upsertOrder(order: OrderProjection): void {
      orders.set(order.id, { ...order, items: order.items.map(i => ({ ...i })) });
    },

    getOrder(id: string): OrderProjection | null {
      const o = orders.get(id);
      return o ? { ...o, items: o.items.map(i => ({ ...i })) } : null;
    },

    getAllOrders(): OrderProjection[] {
      return Array.from(orders.values()).map(o => ({
        ...o,
        items: o.items.map(i => ({ ...i })),
      }));
    },

    updateOrderStatus(id: string, status: 'placed' | 'shipped', shippedAt?: number): void {
      const order = orders.get(id);
      if (order) {
        order.status = status;
        if (shippedAt !== undefined) {
          order.shippedAt = shippedAt;
        }
      }
    },

    // ── Fulfillment methods ───────────────────────────────────────────────
    upsertFulfillment(fulfillment: FulfillmentProjection): void {
      fulfillments.set(fulfillment.orderId, { ...fulfillment });
    },

    getFulfillment(orderId: string): FulfillmentProjection | null {
      const f = fulfillments.get(orderId);
      return f ? { ...f } : null;
    },

    getAllFulfillments(): FulfillmentProjection[] {
      return Array.from(fulfillments.values()).map(f => ({ ...f }));
    },

    updateFulfillment(orderId: string, updates: Partial<FulfillmentProjection>): void {
      const f = fulfillments.get(orderId);
      if (f) {
        Object.assign(f, updates);
      }
    },
  };
}