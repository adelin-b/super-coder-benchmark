import { describe, it, expect } from 'vitest';
import { createEventStore, EventStoreError } from './event-store.js';

describe('HARD-2: Event Sourcing with Snapshotting', () => {
  // --- Basic append and getState ---
  it('appends events and projects state correctly', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('cart1', 'ItemAdded', { sku: 'A', quantity: 2, unitPrice: 10 }, 1000);
    store.append('cart1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 25 }, 1001);
    const state = store.getState('cart1');
    expect(state.items).toHaveLength(2);
    expect(state.totalAmount).toBe(45); // 2*10 + 1*25
    expect(state.eventCount).toBe(2);
    expect(state.lastVersion).toBe(2);
  });

  it('returns empty state for non-existent aggregate', () => {
    const store = createEventStore({ snapshotEvery: 5 });
    const state = store.getState('unknown');
    expect(state.items).toHaveLength(0);
    expect(state.totalAmount).toBe(0);
    expect(state.eventCount).toBe(0);
    expect(state.lastVersion).toBe(0);
  });

  // --- ItemAdded dedup: same SKU increases quantity ---
  it('ItemAdded for existing SKU increases quantity, keeps old price', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'X', quantity: 3, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'X', quantity: 2, unitPrice: 20 }, 200);
    const state = store.getState('c1');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(5);
    expect(state.items[0].unitPrice).toBe(10); // keeps original price
    expect(state.totalAmount).toBe(50); // 5 * 10
  });

  // --- ItemRemoved ---
  it('removes item by SKU', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 2, unitPrice: 5 }, 200);
    store.append('c1', 'ItemRemoved', { sku: 'A' }, 300);
    const state = store.getState('c1');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].sku).toBe('B');
    expect(state.totalAmount).toBe(10);
  });

  it('ItemRemoved for non-existent SKU is no-op', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemRemoved', { sku: 'Z' }, 200);
    expect(store.getState('c1').items).toHaveLength(1);
  });

  // --- QuantityChanged ---
  it('QuantityChanged sets absolute quantity', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 5, unitPrice: 10 }, 100);
    store.append('c1', 'QuantityChanged', { sku: 'A', quantity: 2 }, 200);
    const state = store.getState('c1');
    expect(state.items[0].quantity).toBe(2);
    expect(state.totalAmount).toBe(20);
  });

  it('QuantityChanged to 0 removes item', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 5, unitPrice: 10 }, 100);
    store.append('c1', 'QuantityChanged', { sku: 'A', quantity: 0 }, 200);
    expect(store.getState('c1').items).toHaveLength(0);
    expect(store.getState('c1').totalAmount).toBe(0);
  });

  it('QuantityChanged for non-existent SKU is no-op', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'QuantityChanged', { sku: 'Z', quantity: 5 }, 200);
    expect(store.getState('c1').items).toHaveLength(1);
  });

  // --- PriceUpdated ---
  it('PriceUpdated changes unit price', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 3, unitPrice: 10 }, 100);
    store.append('c1', 'PriceUpdated', { sku: 'A', unitPrice: 15 }, 200);
    const state = store.getState('c1');
    expect(state.items[0].unitPrice).toBe(15);
    expect(state.totalAmount).toBe(45);
  });

  // --- Cleared ---
  it('Cleared removes all items', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 2, unitPrice: 5 }, 200);
    store.append('c1', 'Cleared', {}, 300);
    const state = store.getState('c1');
    expect(state.items).toHaveLength(0);
    expect(state.totalAmount).toBe(0);
    expect(state.eventCount).toBe(3);
  });

  // --- Snapshotting ---
  it('auto-snapshots at configured interval', () => {
    const store = createEventStore({ snapshotEvery: 3 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 2, unitPrice: 5 }, 200);
    expect(store.getSnapshot('c1')).toBeNull();
    store.append('c1', 'ItemAdded', { sku: 'C', quantity: 1, unitPrice: 20 }, 300); // version 3
    const snap = store.getSnapshot('c1');
    expect(snap).not.toBeNull();
    expect(snap!.atVersion).toBe(3);
    expect(snap!.state.items).toHaveLength(3);
  });

  it('replay from snapshot equals full replay', () => {
    const store = createEventStore({ snapshotEvery: 2 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 3, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 25 }, 200); // snap at v2
    store.append('c1', 'QuantityChanged', { sku: 'A', quantity: 1 }, 300);
    store.append('c1', 'PriceUpdated', { sku: 'B', unitPrice: 30 }, 400); // snap at v4

    const state = store.getState('c1');
    expect(state.items).toHaveLength(2);
    expect(state.totalAmount).toBe(40); // 1*10 + 1*30
    expect(state.eventCount).toBe(4);
    expect(state.lastVersion).toBe(4);

    // Verify snapshot is at version 4
    const snap = store.getSnapshot('c1');
    expect(snap!.atVersion).toBe(4);
  });

  it('events between snapshots are correctly replayed', () => {
    const store = createEventStore({ snapshotEvery: 3 });
    // 6 events: snapshots at v3 and v6
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 20 }, 200);
    store.append('c1', 'ItemAdded', { sku: 'C', quantity: 1, unitPrice: 30 }, 300); // snap v3
    store.append('c1', 'ItemRemoved', { sku: 'B' }, 400);
    store.append('c1', 'QuantityChanged', { sku: 'A', quantity: 5 }, 500);
    // Before v6 snap, add one more
    const state5 = store.getState('c1');
    expect(state5.items).toHaveLength(2); // A and C
    expect(state5.totalAmount).toBe(80); // 5*10 + 1*30

    store.append('c1', 'PriceUpdated', { sku: 'C', unitPrice: 0 }, 600); // snap v6
    const state6 = store.getState('c1');
    expect(state6.totalAmount).toBe(50); // 5*10 + 1*0
  });

  // --- Manual snapshot ---
  it('takeSnapshot works manually', () => {
    const store = createEventStore({ snapshotEvery: 100 }); // high interval, no auto
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 2, unitPrice: 5 }, 100);
    const snap = store.takeSnapshot('c1');
    expect(snap.atVersion).toBe(1);
    expect(snap.state.totalAmount).toBe(10);
  });

  // --- getEvents ---
  it('getEvents returns all events', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemRemoved', { sku: 'A' }, 200);
    const events = store.getEvents('c1');
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('ItemAdded');
    expect(events[1].type).toBe('ItemRemoved');
  });

  it('getEvents with afterVersion filters correctly', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 20 }, 200);
    store.append('c1', 'ItemRemoved', { sku: 'A' }, 300);
    const events = store.getEvents('c1', 1);
    expect(events).toHaveLength(2);
    expect(events[0].version).toBe(2);
  });

  // --- Aggregate isolation ---
  it('different aggregates are independent', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100);
    store.append('c2', 'ItemAdded', { sku: 'B', quantity: 2, unitPrice: 20 }, 100);
    expect(store.getState('c1').totalAmount).toBe(10);
    expect(store.getState('c2').totalAmount).toBe(40);
  });

  // --- Version numbering ---
  it('versions are sequential per aggregate starting at 1', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    expect(store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100)).toBe(1);
    expect(store.append('c1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 5 }, 200)).toBe(2);
    expect(store.append('c2', 'ItemAdded', { sku: 'X', quantity: 1, unitPrice: 1 }, 100)).toBe(1);
  });

  // --- Validation ---
  it('throws on snapshotEvery < 1', () => {
    expect(() => createEventStore({ snapshotEvery: 0 })).toThrow(EventStoreError);
  });

  it('throws on empty aggregateId', () => {
    const store = createEventStore({ snapshotEvery: 5 });
    expect(() => store.append('', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 10 }, 100))
      .toThrow(EventStoreError);
  });

  it('throws on ItemAdded with quantity < 1', () => {
    const store = createEventStore({ snapshotEvery: 5 });
    expect(() => store.append('c1', 'ItemAdded', { sku: 'A', quantity: 0, unitPrice: 10 }, 100))
      .toThrow(EventStoreError);
  });

  it('throws on ItemAdded with negative unitPrice', () => {
    const store = createEventStore({ snapshotEvery: 5 });
    expect(() => store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: -5 }, 100))
      .toThrow(EventStoreError);
  });

  it('throws on PriceUpdated with negative unitPrice', () => {
    const store = createEventStore({ snapshotEvery: 5 });
    expect(() => store.append('c1', 'PriceUpdated', { sku: 'A', unitPrice: -1 }, 100))
      .toThrow(EventStoreError);
  });

  // --- Complex scenario: clear then rebuild ---
  it('clear then add items rebuilds correctly', () => {
    const store = createEventStore({ snapshotEvery: 100 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 1, unitPrice: 100 }, 100);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 2, unitPrice: 50 }, 200);
    store.append('c1', 'Cleared', {}, 300);
    store.append('c1', 'ItemAdded', { sku: 'C', quantity: 1, unitPrice: 999 }, 400);
    const state = store.getState('c1');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].sku).toBe('C');
    expect(state.totalAmount).toBe(999);
    expect(state.eventCount).toBe(4);
  });

  // --- Snapshot consistency with complex sequence ---
  it('snapshot + post-snapshot events are consistent', () => {
    const store = createEventStore({ snapshotEvery: 2 });
    store.append('c1', 'ItemAdded', { sku: 'A', quantity: 10, unitPrice: 1 }, 100);
    store.append('c1', 'PriceUpdated', { sku: 'A', unitPrice: 5 }, 200); // snap at v2
    // State at snapshot: A qty=10, price=5, total=50
    store.append('c1', 'QuantityChanged', { sku: 'A', quantity: 3 }, 300);
    store.append('c1', 'ItemAdded', { sku: 'B', quantity: 1, unitPrice: 100 }, 400); // snap at v4

    const state = store.getState('c1');
    expect(state.totalAmount).toBe(115); // 3*5 + 1*100
    expect(state.eventCount).toBe(4);

    const snap = store.getSnapshot('c1');
    expect(snap!.atVersion).toBe(4);
    expect(snap!.state.totalAmount).toBe(115);
  });
});
