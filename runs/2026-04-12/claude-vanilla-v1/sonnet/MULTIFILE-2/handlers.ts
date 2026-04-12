// ── Event Handlers ──────────────────────────────────────────────────────────

import type { DomainEvent } from './events.js';
import { createEventBus } from './events.js';
import { createProjectionStore } from './store.js';

type EventBus = ReturnType<typeof createEventBus>;
type ProjectionStore = ReturnType<typeof createProjectionStore>;

export function wireHandlers(bus: EventBus, store: ProjectionStore): void {
  // ── User handlers ───────────────────────────────────────────────────────
  bus.subscribe('user.created', (event: DomainEvent<'user.created'>) => {
    const { userId, name, email } = event.payload as {
      userId: string;
      name: string;
      email: string;
    };
    store.upsertUser({
      id: userId,
      name,
      email,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    });
  });

  bus.subscribe('user.updated', (event: DomainEvent<'user.updated'>) => {
    const { userId, name, email } = event.payload as {
      userId: string;
      name?: string;
      email?: string;
    };
    const existing = store.getUser(userId);
    if (existing) {
      store.upsertUser({
        ...existing,
        name: name ?? existing.name,
        email: email ?? existing.email,
        updatedAt: event.timestamp,
      });
    }
  });

  // ── Order handlers ──────────────────────────────────────────────────────
  bus.subscribe('order.placed', (event: DomainEvent<'order.placed'>) => {
    const { orderId, userId, items } = event.payload as {
      orderId: string;
      userId: string;
      items: Array<{ sku: string; quantity: number; price: number }>;
    };
    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    store.upsertOrder({
      id: orderId,
      userId,
      items,
      total,
      status: 'placed',
      placedAt: event.timestamp,
      shippedAt: null,
    });
  });

  bus.subscribe('order.shipped', (event: DomainEvent<'order.shipped'>) => {
    const { orderId } = event.payload as { orderId: string };
    store.updateOrderStatus(orderId, 'shipped', event.timestamp);
  });

  // ── Fulfillment handlers ────────────────────────────────────────────────
  bus.subscribe('payment.processed', (event: DomainEvent<'payment.processed'>) => {
    const { orderId } = event.payload as {
      orderId: string;
      amount: number;
      transactionId: string;
    };
    const existing = store.getFulfillment(orderId);
    if (existing) {
      store.updateFulfillment(orderId, { paymentProcessed: true });
      const updated = store.getFulfillment(orderId)!;
      if (updated.inventoryReserved) {
        store.updateFulfillment(orderId, { status: 'processing' });
      }
    } else {
      store.upsertFulfillment({
        orderId,
        status: 'pending',
        paymentProcessed: true,
        inventoryReserved: false,
        startedAt: null,
        completedAt: null,
        failureReason: null,
      });
    }
  });

  bus.subscribe('inventory.reserved', (event: DomainEvent<'inventory.reserved'>) => {
    const { orderId } = event.payload as {
      orderId: string;
      items: Array<{ sku: string; quantity: number }>;
    };
    const existing = store.getFulfillment(orderId);
    if (existing) {
      store.updateFulfillment(orderId, { inventoryReserved: true });
      const updated = store.getFulfillment(orderId)!;
      if (updated.paymentProcessed) {
        store.updateFulfillment(orderId, { status: 'processing' });
      }
    } else {
      store.upsertFulfillment({
        orderId,
        status: 'pending',
        paymentProcessed: false,
        inventoryReserved: true,
        startedAt: null,
        completedAt: null,
        failureReason: null,
      });
    }
  });

  bus.subscribe('fulfillment.started', (event: DomainEvent<'fulfillment.started'>) => {
    const { orderId } = event.payload as { orderId: string };
    store.updateFulfillment(orderId, {
      status: 'processing',
      startedAt: event.timestamp,
    });
  });

  bus.subscribe('fulfillment.completed', (event: DomainEvent<'fulfillment.completed'>) => {
    const { orderId } = event.payload as {
      orderId: string;
      trackingNumber: string;
    };
    store.updateFulfillment(orderId, {
      status: 'shipped',
      completedAt: event.timestamp,
    });
  });

  bus.subscribe('fulfillment.failed', (event: DomainEvent<'fulfillment.failed'>) => {
    const { orderId, reason } = event.payload as {
      orderId: string;
      reason: string;
    };
    store.updateFulfillment(orderId, {
      status: 'failed',
      failureReason: reason,
    });
  });
}