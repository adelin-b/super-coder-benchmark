# HARD-2: Event Sourcing with Snapshotting

## Overview
Implement an event-sourced aggregate store with periodic snapshotting. The store must support appending events, replaying to rebuild state, taking snapshots at configurable intervals, and replaying from the most recent snapshot. Events can have different schemas (versioned), and the system must handle projection of mixed event types.

## Exported API

```ts
export type EventType = 'ItemAdded' | 'ItemRemoved' | 'QuantityChanged' | 'PriceUpdated' | 'Cleared';

export interface DomainEvent {
  type: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  version: number;        // monotonically increasing per aggregate
  timestamp: number;      // ms since epoch
}

export interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

/** The projected state of a shopping cart aggregate. */
export interface CartState {
  id: string;
  items: CartItem[];
  totalAmount: number;      // sum of quantity * unitPrice for each item
  eventCount: number;       // total events applied (including pre-snapshot)
  lastVersion: number;      // version of the last applied event
}

export interface Snapshot {
  aggregateId: string;
  state: CartState;
  atVersion: number;
  takenAt: number;          // timestamp
}

export class EventStoreError extends Error {}

export function createEventStore(config: {
  snapshotEvery: number;    // take snapshot every N events
}): {
  /** Append a new event. Returns the assigned version number. */
  append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number;

  /** Get current projected state by replaying from latest snapshot. */
  getState(aggregateId: string): CartState;

  /** Get all events for an aggregate, optionally after a version. */
  getEvents(aggregateId: string, afterVersion?: number): DomainEvent[];

  /** Get the latest snapshot, or null if none. */
  getSnapshot(aggregateId: string): Snapshot | null;

  /** Force a snapshot at the current state. */
  takeSnapshot(aggregateId: string): Snapshot;

  /** Get the full event count for an aggregate. */
  getEventCount(aggregateId: string): number;
};
```

## Detailed Requirements

### Event Appending
- Events are appended with a monotonically increasing version per aggregate, starting at 1.
- If `append` is called for an aggregate that doesn't exist, it creates it.
- The `timestamp` is provided by the caller (for deterministic testing).
- After appending, if `version % snapshotEvery === 0`, automatically take a snapshot.

### Projection Rules (Cart Domain)
Apply events to produce `CartState`:

| Event Type | Payload | Effect |
|------------|---------|--------|
| `ItemAdded` | `{ sku: string, quantity: number, unitPrice: number }` | Add item. If SKU already exists, increase quantity (keep existing unitPrice). |
| `ItemRemoved` | `{ sku: string }` | Remove item by SKU. If SKU doesn't exist, no-op. |
| `QuantityChanged` | `{ sku: string, quantity: number }` | Set quantity for SKU. If quantity <= 0, remove the item. If SKU doesn't exist, no-op. |
| `PriceUpdated` | `{ sku: string, unitPrice: number }` | Update unit price. If SKU doesn't exist, no-op. |
| `Cleared` | `{}` | Remove all items. |

`totalAmount` must always equal the sum of `quantity * unitPrice` for all items, recalculated after every event.

### Replay from Snapshot
- `getState` must find the latest snapshot (if any), then replay only events after that snapshot's version.
- The result must be identical to replaying all events from the start.
- If no events exist for an aggregate, return a default empty state.

### Snapshot Mechanics
- Snapshots are stored per aggregate.
- Only the latest snapshot is kept (newer replaces older).
- `takeSnapshot` captures the current projected state.
- Auto-snapshot triggers after `append` when version is a multiple of `snapshotEvery`.

### Validation
- `snapshotEvery` must be >= 1.
- `aggregateId` must be a non-empty string.
- `quantity` in `ItemAdded` must be >= 1.
- `unitPrice` in `ItemAdded` and `PriceUpdated` must be >= 0.
- `quantity` in `QuantityChanged` can be any integer (including 0 or negative, which triggers removal).
- Throw `EventStoreError` for invalid inputs.

### Edge Cases
- Replaying from a snapshot mid-stream must produce the same state as full replay.
- Events between automatic snapshots must be correctly captured.
- `getState` on a non-existent aggregate returns `{ id, items: [], totalAmount: 0, eventCount: 0, lastVersion: 0 }`.
- Multiple rapid events at the same timestamp are fine (version distinguishes them).

## Invariants
1. `getState(id).totalAmount === sum(item.quantity * item.unitPrice)` for all items, always.
2. `getState(id).eventCount === getEventCount(id)`.
3. `getState(id).lastVersion === getEvents(id).length` (or last event's version).
4. Replaying from snapshot + subsequent events === replaying all events from scratch.
5. After auto-snapshot at version N, `getSnapshot(id).atVersion === N`.
