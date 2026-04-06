export type EventType = 'ItemAdded' | 'ItemRemoved' | 'QuantityChanged' | 'PriceUpdated' | 'Cleared';

export interface DomainEvent {
  type: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  version: number;
  timestamp: number;
}

export interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface CartState {
  id: string;
  items: CartItem[];
  totalAmount: number;
  eventCount: number;
  lastVersion: number;
}

export interface Snapshot {
  aggregateId: string;
  state: CartState;
  atVersion: number;
  takenAt: number;
}

export class EventStoreError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'EventStoreError';
  }
}

function emptyState(id: string): CartState {
  return { id, items: [], totalAmount: 0, eventCount: 0, lastVersion: 0 };
}

function cloneState(s: CartState): CartState {
  return {
    id: s.id,
    items: s.items.map(i => ({ ...i })),
    totalAmount: s.totalAmount,
    eventCount: s.eventCount,
    lastVersion: s.lastVersion,
  };
}

function recalcTotal(state: CartState): void {
  state.totalAmount = state.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function applyEvent(state: CartState, event: DomainEvent): void {
  state.eventCount++;
  state.lastVersion = event.version;

  switch (event.type) {
    case 'ItemAdded': {
      const { sku, quantity, unitPrice } = event.payload as { sku: string; quantity: number; unitPrice: number };
      const existing = state.items.find(i => i.sku === sku);
      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push({ sku, quantity, unitPrice });
      }
      break;
    }
    case 'ItemRemoved': {
      const { sku } = event.payload as { sku: string };
      state.items = state.items.filter(i => i.sku !== sku);
      break;
    }
    case 'QuantityChanged': {
      const { sku, quantity } = event.payload as { sku: string; quantity: number };
      const item = state.items.find(i => i.sku === sku);
      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter(i => i.sku !== sku);
        } else {
          item.quantity = quantity;
        }
      }
      break;
    }
    case 'PriceUpdated': {
      const { sku, unitPrice } = event.payload as { sku: string; unitPrice: number };
      const item = state.items.find(i => i.sku === sku);
      if (item) {
        item.unitPrice = unitPrice;
      }
      break;
    }
    case 'Cleared': {
      state.items = [];
      break;
    }
  }

  recalcTotal(state);
}

export function createEventStore(config: { snapshotEvery: number }) {
  if (config.snapshotEvery < 1) throw new EventStoreError('snapshotEvery must be >= 1');

  const events = new Map<string, DomainEvent[]>();
  const snapshots = new Map<string, Snapshot>();

  function getAggregateEvents(aggregateId: string): DomainEvent[] {
    if (!events.has(aggregateId)) {
      events.set(aggregateId, []);
    }
    return events.get(aggregateId)!;
  }

  function replayFromSnapshot(aggregateId: string): CartState {
    const snap = snapshots.get(aggregateId);
    const allEvents = getAggregateEvents(aggregateId);

    let state: CartState;
    let startAfterVersion: number;

    if (snap) {
      state = cloneState(snap.state);
      startAfterVersion = snap.atVersion;
    } else {
      state = emptyState(aggregateId);
      startAfterVersion = 0;
    }

    for (const event of allEvents) {
      if (event.version > startAfterVersion) {
        applyEvent(state, event);
      }
    }

    return state;
  }

  function doTakeSnapshot(aggregateId: string): Snapshot {
    const state = replayFromSnapshot(aggregateId);
    const snapshot: Snapshot = {
      aggregateId,
      state: cloneState(state),
      atVersion: state.lastVersion,
      takenAt: Date.now(),
    };
    snapshots.set(aggregateId, snapshot);
    return snapshot;
  }

  return {
    append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number {
      if (!aggregateId || typeof aggregateId !== 'string') {
        throw new EventStoreError('aggregateId must be a non-empty string');
      }

      // Validate payloads
      if (type === 'ItemAdded') {
        const { quantity, unitPrice } = payload as { quantity?: number; unitPrice?: number };
        if (quantity === undefined || quantity < 1) throw new EventStoreError('ItemAdded quantity must be >= 1');
        if (unitPrice === undefined || unitPrice < 0) throw new EventStoreError('ItemAdded unitPrice must be >= 0');
      }
      if (type === 'PriceUpdated') {
        const { unitPrice } = payload as { unitPrice?: number };
        if (unitPrice === undefined || unitPrice < 0) throw new EventStoreError('PriceUpdated unitPrice must be >= 0');
      }

      const aggEvents = getAggregateEvents(aggregateId);
      const version = aggEvents.length + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload: { ...payload },
        version,
        timestamp,
      };

      aggEvents.push(event);

      // Auto-snapshot
      if (version % config.snapshotEvery === 0) {
        doTakeSnapshot(aggregateId);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!events.has(aggregateId)) {
        return emptyState(aggregateId);
      }
      return replayFromSnapshot(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      const allEvents = getAggregateEvents(aggregateId);
      if (afterVersion !== undefined) {
        return allEvents.filter(e => e.version > afterVersion);
      }
      return [...allEvents];
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      return snapshots.get(aggregateId) ?? null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      return doTakeSnapshot(aggregateId);
    },

    getEventCount(aggregateId: string): number {
      return getAggregateEvents(aggregateId).length;
    },
  };
}
