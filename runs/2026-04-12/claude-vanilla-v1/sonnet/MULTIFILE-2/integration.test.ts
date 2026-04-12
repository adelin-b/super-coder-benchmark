import { describe, it, expect, vi } from 'vitest';
import { createEventBus, type DomainEvent } from './events.js';
import { createProjectionStore } from './store.js';
import { wireHandlers } from './handlers.js';
import { createSagaOrchestrator } from './saga.js';

function setup() {
  const bus = createEventBus();
  const store = createProjectionStore();
  wireHandlers(bus, store);
  const orchestrator = createSagaOrchestrator();
  return { bus, store, orchestrator };
}

let eventIdCounter = 0;
function makeEvent<T extends string>(type: T, payload: Record<string, unknown>, timestamp = Date.now()): DomainEvent<any> {
  return {
    id: `evt-${++eventIdCounter}`,
    type: type as any,
    payload,
    timestamp,
    version: eventIdCounter,
  };
}

describe('Integration: Old + New Systems', () => {
  // ── Old functionality still works with new handlers wired (3 tests) ────

  it('user + order flow works alongside fulfillment handlers', () => {
    const { bus, store } = setup();

    bus.publish(makeEvent('user.created', { userId: 'u1', name: 'Alice', email: 'a@t.com' }, 100));
    bus.publish(makeEvent('order.placed', {
      orderId: 'o1',
      userId: 'u1',
      items: [{ sku: 'SKU-1', quantity: 2, price: 15 }],
    }, 200));
    bus.publish(makeEvent('order.shipped', { orderId: 'o1' }, 300));

    expect(store.getUser('u1')!.name).toBe('Alice');
    expect(store.getOrder('o1')!.status).toBe('shipped');
    expect(store.getOrder('o1')!.total).toBe(30);
  });

  it('new event types have subscribers after wireHandlers', () => {
    const { bus } = setup();
    expect(bus.getSubscriberCount('payment.processed')).toBe(1);
    expect(bus.getSubscriberCount('inventory.reserved')).toBe(1);
    expect(bus.getSubscriberCount('fulfillment.started')).toBe(1);
    expect(bus.getSubscriberCount('fulfillment.completed')).toBe(1);
    expect(bus.getSubscriberCount('fulfillment.failed')).toBe(1);
  });

  it('old event types still have subscribers after wireHandlers', () => {
    const { bus } = setup();
    expect(bus.getSubscriberCount('user.created')).toBe(1);
    expect(bus.getSubscriberCount('user.updated')).toBe(1);
    expect(bus.getSubscriberCount('order.placed')).toBe(1);
    expect(bus.getSubscriberCount('order.shipped')).toBe(1);
  });

  // ── Fulfillment projection via events (3 tests) ───────────────────────

  it('payment.processed creates a fulfillment record', () => {
    const { bus, store } = setup();

    bus.publish(makeEvent('payment.processed', {
      orderId: 'o1',
      amount: 100,
      transactionId: 'tx-1',
    }, 1000));

    const f = store.getFulfillment('o1');
    expect(f).not.toBeNull();
    expect(f!.paymentProcessed).toBe(true);
    expect(f!.inventoryReserved).toBe(false);
    expect(f!.status).toBe('pending');
  });

  it('payment + inventory reserved transitions to processing', () => {
    const { bus, store } = setup();

    bus.publish(makeEvent('payment.processed', {
      orderId: 'o1',
      amount: 50,
      transactionId: 'tx-1',
    }, 1000));

    bus.publish(makeEvent('inventory.reserved', {
      orderId: 'o1',
      items: [{ sku: 'A', quantity: 1 }],
    }, 1100));

    const f = store.getFulfillment('o1');
    expect(f!.paymentProcessed).toBe(true);
    expect(f!.inventoryReserved).toBe(true);
    expect(f!.status).toBe('processing');
  });

  it('fulfillment.completed sets status to shipped', () => {
    const { bus, store } = setup();

    // Set up the fulfillment record
    bus.publish(makeEvent('payment.processed', {
      orderId: 'o1', amount: 10, transactionId: 'tx-1',
    }, 1000));

    bus.publish(makeEvent('fulfillment.started', { orderId: 'o1' }, 1100));
    bus.publish(makeEvent('fulfillment.completed', { orderId: 'o1', trackingNumber: 'TRK-123' }, 1200));

    const f = store.getFulfillment('o1');
    expect(f!.status).toBe('shipped');
    expect(f!.completedAt).toBe(1200);
  });

  // ── Saga + event system working together (4 tests) ────────────────────

  it('saga steps can publish events that update projections', async () => {
    const { bus, store, orchestrator } = setup();

    orchestrator.register({
      name: 'order-fulfillment',
      steps: [
        {
          name: 'process-payment',
          execute: () => {
            bus.publish(makeEvent('payment.processed', {
              orderId: 'o1', amount: 100, transactionId: 'tx-1',
            }, 2000));
          },
          compensate: vi.fn(),
        },
        {
          name: 'reserve-inventory',
          execute: () => {
            bus.publish(makeEvent('inventory.reserved', {
              orderId: 'o1', items: [{ sku: 'X', quantity: 1 }],
            }, 2100));
          },
          compensate: vi.fn(),
        },
        {
          name: 'start-fulfillment',
          execute: () => {
            bus.publish(makeEvent('fulfillment.started', { orderId: 'o1' }, 2200));
          },
          compensate: vi.fn(),
        },
        {
          name: 'complete-fulfillment',
          execute: () => {
            bus.publish(makeEvent('fulfillment.completed', {
              orderId: 'o1', trackingNumber: 'TRK-456',
            }, 2300));
          },
          compensate: vi.fn(),
        },
      ],
    });

    const saga = await orchestrator.start('order-fulfillment', 'saga-o1');
    expect(saga.status).toBe('completed');

    const f = store.getFulfillment('o1');
    expect(f!.status).toBe('shipped');
    expect(f!.paymentProcessed).toBe(true);
    expect(f!.inventoryReserved).toBe(true);
  });

  it('saga failure publishes fulfillment.failed and compensates', async () => {
    const { bus, store, orchestrator } = setup();

    orchestrator.register({
      name: 'failing-fulfillment',
      steps: [
        {
          name: 'process-payment',
          execute: () => {
            bus.publish(makeEvent('payment.processed', {
              orderId: 'o2', amount: 50, transactionId: 'tx-2',
            }, 3000));
          },
          compensate: () => {
            // Compensation: refund would happen here
          },
        },
        {
          name: 'reserve-inventory',
          execute: () => { throw new Error('Out of stock'); },
          compensate: vi.fn(),
        },
      ],
    });

    const saga = await orchestrator.start('failing-fulfillment', 'saga-o2');
    expect(saga.status).toBe('failed');
    expect(saga.error).toContain('Out of stock');

    // Payment was processed before failure
    const f = store.getFulfillment('o2');
    expect(f).not.toBeNull();
    expect(f!.paymentProcessed).toBe(true);
  });

  it('fulfillment.failed event records failure reason in projection', () => {
    const { bus, store } = setup();

    bus.publish(makeEvent('payment.processed', {
      orderId: 'o3', amount: 10, transactionId: 'tx-3',
    }, 4000));

    bus.publish(makeEvent('fulfillment.failed', {
      orderId: 'o3', reason: 'Warehouse fire',
    }, 4100));

    const f = store.getFulfillment('o3');
    expect(f!.status).toBe('failed');
    expect(f!.failureReason).toBe('Warehouse fire');
  });

  it('full end-to-end: user, order, fulfillment saga, all projections correct', async () => {
    const { bus, store, orchestrator } = setup();

    // 1. Create user
    bus.publish(makeEvent('user.created', { userId: 'u10', name: 'Charlie', email: 'c@t.com' }, 5000));

    // 2. Place order
    bus.publish(makeEvent('order.placed', {
      orderId: 'o10',
      userId: 'u10',
      items: [{ sku: 'WIDGET', quantity: 5, price: 20 }],
    }, 5100));

    // 3. Run fulfillment saga
    orchestrator.register({
      name: 'e2e-fulfillment',
      steps: [
        {
          name: 'payment',
          execute: () => {
            bus.publish(makeEvent('payment.processed', {
              orderId: 'o10', amount: 100, transactionId: 'tx-e2e',
            }, 5200));
          },
          compensate: vi.fn(),
        },
        {
          name: 'inventory',
          execute: () => {
            bus.publish(makeEvent('inventory.reserved', {
              orderId: 'o10', items: [{ sku: 'WIDGET', quantity: 5 }],
            }, 5300));
          },
          compensate: vi.fn(),
        },
        {
          name: 'ship',
          execute: () => {
            bus.publish(makeEvent('fulfillment.started', { orderId: 'o10' }, 5400));
            bus.publish(makeEvent('fulfillment.completed', {
              orderId: 'o10', trackingNumber: 'TRK-E2E',
            }, 5500));
            bus.publish(makeEvent('order.shipped', { orderId: 'o10' }, 5500));
          },
          compensate: vi.fn(),
        },
      ],
    });

    const saga = await orchestrator.start('e2e-fulfillment', 'saga-e2e');
    expect(saga.status).toBe('completed');

    // Verify ALL projections
    const user = store.getUser('u10');
    expect(user!.name).toBe('Charlie');

    const order = store.getOrder('o10');
    expect(order!.status).toBe('shipped');
    expect(order!.total).toBe(100);

    const fulfillment = store.getFulfillment('o10');
    expect(fulfillment!.status).toBe('shipped');
    expect(fulfillment!.paymentProcessed).toBe(true);
    expect(fulfillment!.inventoryReserved).toBe(true);
    expect(fulfillment!.completedAt).toBe(5500);
  });
});
