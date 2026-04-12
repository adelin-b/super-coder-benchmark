import { describe, it, expect, vi } from 'vitest';
import { createEventBus, type DomainEvent, type EventType } from './events.js';
import { createProjectionStore } from './store.js';
import { wireHandlers } from './handlers.js';

// ── Event Bus Tests (8 tests) ───────────────────────────────────────────────

describe('Event Bus', () => {
  it('publishes events to matching subscribers', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe('user.created', handler);

    const event: DomainEvent<'user.created'> = {
      id: 'evt-1',
      type: 'user.created',
      payload: { userId: 'u1', name: 'Alice', email: 'alice@test.com' },
      timestamp: 1000,
      version: 1,
    };
    bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver events to non-matching subscribers', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe('user.updated', handler);

    bus.publish({
      id: 'evt-1',
      type: 'user.created',
      payload: {},
      timestamp: 1000,
      version: 1,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers for the same event type', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe('order.placed', h1);
    bus.subscribe('order.placed', h2);

    bus.publish({
      id: 'evt-1',
      type: 'order.placed',
      payload: {},
      timestamp: 1000,
      version: 1,
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the handler', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe('user.created', handler);

    unsub();

    bus.publish({
      id: 'evt-1',
      type: 'user.created',
      payload: {},
      timestamp: 1000,
      version: 1,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe only removes the specific handler', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe('order.shipped', h1);
    const unsub2 = bus.subscribe('order.shipped', h2);

    unsub2();

    bus.publish({
      id: 'evt-1',
      type: 'order.shipped',
      payload: {},
      timestamp: 1000,
      version: 1,
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).not.toHaveBeenCalled();
  });

  it('getSubscriberCount returns correct count', () => {
    const bus = createEventBus();
    expect(bus.getSubscriberCount('user.created')).toBe(0);

    bus.subscribe('user.created', vi.fn());
    bus.subscribe('user.created', vi.fn());
    expect(bus.getSubscriberCount('user.created')).toBe(2);
  });

  it('getSubscriberCount decrements after unsubscribe', () => {
    const bus = createEventBus();
    const unsub = bus.subscribe('order.placed', vi.fn());
    bus.subscribe('order.placed', vi.fn());

    expect(bus.getSubscriberCount('order.placed')).toBe(2);
    unsub();
    expect(bus.getSubscriberCount('order.placed')).toBe(1);
  });

  it('publish with no subscribers does not throw', () => {
    const bus = createEventBus();
    expect(() => {
      bus.publish({
        id: 'evt-1',
        type: 'user.created',
        payload: {},
        timestamp: 1000,
        version: 1,
      });
    }).not.toThrow();
  });
});

// ── Projection Store Tests (6 tests) ────────────────────────────────────────

describe('Projection Store', () => {
  it('upserts and retrieves a user', () => {
    const store = createProjectionStore();
    store.upsertUser({
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const user = store.getUser('u1');
    expect(user).not.toBeNull();
    expect(user!.name).toBe('Alice');
    expect(user!.email).toBe('alice@test.com');
  });

  it('returns null for non-existent user', () => {
    const store = createProjectionStore();
    expect(store.getUser('unknown')).toBeNull();
  });

  it('getAllUsers returns all users', () => {
    const store = createProjectionStore();
    store.upsertUser({ id: 'u1', name: 'A', email: 'a@t.com', createdAt: 1, updatedAt: 1 });
    store.upsertUser({ id: 'u2', name: 'B', email: 'b@t.com', createdAt: 2, updatedAt: 2 });
    expect(store.getAllUsers()).toHaveLength(2);
  });

  it('upserts and retrieves an order', () => {
    const store = createProjectionStore();
    store.upsertOrder({
      id: 'o1',
      userId: 'u1',
      items: [{ sku: 'SKU-1', quantity: 2, price: 10 }],
      total: 20,
      status: 'placed',
      placedAt: 1000,
      shippedAt: null,
    });

    const order = store.getOrder('o1');
    expect(order).not.toBeNull();
    expect(order!.total).toBe(20);
    expect(order!.status).toBe('placed');
  });

  it('updateOrderStatus changes status and shippedAt', () => {
    const store = createProjectionStore();
    store.upsertOrder({
      id: 'o1',
      userId: 'u1',
      items: [],
      total: 0,
      status: 'placed',
      placedAt: 1000,
      shippedAt: null,
    });

    store.updateOrderStatus('o1', 'shipped', 2000);
    const order = store.getOrder('o1');
    expect(order!.status).toBe('shipped');
    expect(order!.shippedAt).toBe(2000);
  });

  it('returns null for non-existent order', () => {
    const store = createProjectionStore();
    expect(store.getOrder('unknown')).toBeNull();
  });
});

// ── Handler Wiring Tests (6 tests) ──────────────────────────────────────────

describe('Handler Wiring', () => {
  function setup() {
    const bus = createEventBus();
    const store = createProjectionStore();
    wireHandlers(bus, store);
    return { bus, store };
  }

  it('user.created handler creates a user projection', () => {
    const { bus, store } = setup();

    bus.publish({
      id: 'evt-1',
      type: 'user.created',
      payload: { userId: 'u1', name: 'Alice', email: 'alice@test.com' },
      timestamp: 1000,
      version: 1,
    });

    const user = store.getUser('u1');
    expect(user).not.toBeNull();
    expect(user!.name).toBe('Alice');
  });

  it('user.updated handler modifies existing user', () => {
    const { bus, store } = setup();

    bus.publish({
      id: 'evt-1',
      type: 'user.created',
      payload: { userId: 'u1', name: 'Alice', email: 'alice@test.com' },
      timestamp: 1000,
      version: 1,
    });

    bus.publish({
      id: 'evt-2',
      type: 'user.updated',
      payload: { userId: 'u1', name: 'Alicia' },
      timestamp: 2000,
      version: 2,
    });

    const user = store.getUser('u1');
    expect(user!.name).toBe('Alicia');
    expect(user!.email).toBe('alice@test.com'); // unchanged
    expect(user!.updatedAt).toBe(2000);
  });

  it('order.placed handler creates an order projection', () => {
    const { bus, store } = setup();

    bus.publish({
      id: 'evt-1',
      type: 'order.placed',
      payload: {
        orderId: 'o1',
        userId: 'u1',
        items: [
          { sku: 'SKU-A', quantity: 2, price: 10 },
          { sku: 'SKU-B', quantity: 1, price: 25 },
        ],
      },
      timestamp: 1000,
      version: 1,
    });

    const order = store.getOrder('o1');
    expect(order).not.toBeNull();
    expect(order!.total).toBe(45);
    expect(order!.status).toBe('placed');
    expect(order!.items).toHaveLength(2);
  });

  it('order.shipped handler updates order status', () => {
    const { bus, store } = setup();

    bus.publish({
      id: 'evt-1',
      type: 'order.placed',
      payload: { orderId: 'o1', userId: 'u1', items: [{ sku: 'A', quantity: 1, price: 10 }] },
      timestamp: 1000,
      version: 1,
    });

    bus.publish({
      id: 'evt-2',
      type: 'order.shipped',
      payload: { orderId: 'o1' },
      timestamp: 2000,
      version: 2,
    });

    const order = store.getOrder('o1');
    expect(order!.status).toBe('shipped');
    expect(order!.shippedAt).toBe(2000);
  });

  it('wireHandlers registers correct subscriber counts', () => {
    const { bus } = setup();

    // Each of the 4 original event types should have exactly 1 subscriber
    expect(bus.getSubscriberCount('user.created')).toBe(1);
    expect(bus.getSubscriberCount('user.updated')).toBe(1);
    expect(bus.getSubscriberCount('order.placed')).toBe(1);
    expect(bus.getSubscriberCount('order.shipped')).toBe(1);
  });

  it('multiple events build up correct state', () => {
    const { bus, store } = setup();

    // Create two users
    bus.publish({
      id: 'evt-1',
      type: 'user.created',
      payload: { userId: 'u1', name: 'Alice', email: 'a@t.com' },
      timestamp: 100,
      version: 1,
    });
    bus.publish({
      id: 'evt-2',
      type: 'user.created',
      payload: { userId: 'u2', name: 'Bob', email: 'b@t.com' },
      timestamp: 200,
      version: 2,
    });

    // Place an order
    bus.publish({
      id: 'evt-3',
      type: 'order.placed',
      payload: {
        orderId: 'o1',
        userId: 'u1',
        items: [{ sku: 'X', quantity: 3, price: 100 }],
      },
      timestamp: 300,
      version: 3,
    });

    expect(store.getAllUsers()).toHaveLength(2);
    expect(store.getAllOrders()).toHaveLength(1);
    expect(store.getOrder('o1')!.total).toBe(300);
  });
});
