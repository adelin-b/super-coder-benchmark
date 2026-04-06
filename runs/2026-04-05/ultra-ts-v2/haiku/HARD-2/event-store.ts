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

export class EventStoreError extends Error {}

export function createEventStore(config: {
  snapshotEvery: number;
}): {
  append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number;
  getState(aggregateId: string): CartState;
  getEvents(aggregateId: string, afterVersion?: number): DomainEvent[];
  getSnapshot(aggregateId: string): Snapshot | null;
  takeSnapshot(aggregateId: string): Snapshot;
  getEventCount(aggregateId: string): number;
} {
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const events = new Map<string, DomainEvent[]>();
  const snapshots = new Map<string, Snapshot>();
  const versions = new Map<string, number>();

  function validateAggregateId(aggregateId: string) {
    if (!aggregateId || typeof aggregateId !== 'string') {
      throw new EventStoreError("aggregateId must be a non-empty string");
    }
  }

  function projectState(aggregateId: string): CartState {
    const allEvents = events.get(aggregateId) || [];
    
    let state: CartState = {
      id: aggregateId,
      items: [],
      totalAmount: 0,
      eventCount: 0,
      lastVersion: 0,
    };

    const snapshot = snapshots.get(aggregateId);
    let fromVersion = 0;

    if (snapshot) {
      state = {
        id: aggregateId,
        items: snapshot.state.items.map(item => ({ ...item })),
        totalAmount: snapshot.state.totalAmount,
        eventCount: snapshot.atVersion,
        lastVersion: snapshot.atVersion,
      };
      fromVersion = snapshot.atVersion;
    }

    for (const event of allEvents) {
      if (event.version <= fromVersion) continue;

      switch (event.type) {
        case 'ItemAdded': {
          const { sku, quantity, unitPrice } = event.payload as { sku: string; quantity: number; unitPrice: number };
          const existingItem = state.items.find(item => item.sku === sku);
          if (existingItem) {
            existingItem.quantity += quantity;
          } else {
            state.items.push({ sku, quantity, unitPrice });
          }
          break;
        }
        case 'ItemRemoved': {
          const { sku } = event.payload as { sku: string };
          state.items = state.items.filter(item => item.sku !== sku);
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

      state.lastVersion = event.version;
      state.eventCount++;
    }

    state.totalAmount = state.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return state;
  }

  return {
    append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number {
      validateAggregateId(aggregateId);

      if (type === 'ItemAdded') {
        const { quantity, unitPrice } = payload as any;
        if (typeof quantity !== 'number' || quantity < 1) {
          throw new EventStoreError("ItemAdded quantity must be >= 1");
        }
        if (typeof unitPrice !== 'number' || unitPrice < 0) {
          throw new EventStoreError("ItemAdded unitPrice must be >= 0");
        }
      } else if (type === 'PriceUpdated') {
        const { unitPrice } = payload as any;
        if (typeof unitPrice !== 'number' || unitPrice < 0) {
          throw new EventStoreError("PriceUpdated unitPrice must be >= 0");
        }
      }

      const currentVersion = versions.get(aggregateId) || 0;
      const nextVersion = currentVersion + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload,
        version: nextVersion,
        timestamp,
      };

      if (!events.has(aggregateId)) {
        events.set(aggregateId, []);
      }
      events.get(aggregateId)!.push(event);
      versions.set(aggregateId, nextVersion);

      if (nextVersion % config.snapshotEvery === 0) {
        this.takeSnapshot(aggregateId);
      }

      return nextVersion;
    },

    getState(aggregateId: string): CartState {
      validateAggregateId(aggregateId);
      return projectState(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      validateAggregateId(aggregateId);
      const allEvents = events.get(aggregateId) || [];
      if (afterVersion === undefined) {
        return [...allEvents];
      }
      return allEvents.filter(e => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      validateAggregateId(aggregateId);
      return snapshots.get(aggregateId) || null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      validateAggregateId(aggregateId);
      const state = projectState(aggregateId);
      const snapshot: Snapshot = {
        aggregateId,
        state: {
          id: state.id,
          items: state.items.map(item => ({ ...item })),
          totalAmount: state.totalAmount,
          eventCount: state.eventCount,
          lastVersion: state.lastVersion,
        },
        atVersion: state.lastVersion,
        takenAt: Date.now(),
      };
      snapshots.set(aggregateId, snapshot);
      return snapshot;
    },

    getEventCount(aggregateId: string): number {
      validateAggregateId(aggregateId);
      return (events.get(aggregateId) || []).length;
    },
  };
}