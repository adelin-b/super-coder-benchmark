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
  constructor(message: string) {
    super(message);
    this.name = "EventStoreError";
  }
}

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
  // Validate config
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  // Internal storage
  const eventsByAggregate = new Map<string, DomainEvent[]>();
  const snapshotsByAggregate = new Map<string, Snapshot>();

  // Helper to validate aggregateId
  const validateAggregateId = (id: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new EventStoreError("aggregateId must be a non-empty string");
    }
  };

  // Helper to create default state
  const createEmptyState = (id: string): CartState => ({
    id,
    items: [],
    totalAmount: 0,
    eventCount: 0,
    lastVersion: 0,
  });

  // Helper to apply a single event to state
  const applyEvent = (state: CartState, event: DomainEvent): CartState => {
    const newState = { ...state };
    const newItems = [...newState.items];

    switch (event.type) {
      case 'ItemAdded': {
        const { sku, quantity, unitPrice } = event.payload as any;
        if (quantity < 1) {
          throw new EventStoreError("ItemAdded quantity must be >= 1");
        }
        if (unitPrice < 0) {
          throw new EventStoreError("ItemAdded unitPrice must be >= 0");
        }
        const existingIdx = newItems.findIndex(item => item.sku === sku);
        if (existingIdx >= 0) {
          newItems[existingIdx] = {
            ...newItems[existingIdx],
            quantity: newItems[existingIdx].quantity + quantity,
          };
        } else {
          newItems.push({ sku, quantity, unitPrice });
        }
        break;
      }
      case 'ItemRemoved': {
        const { sku } = event.payload as any;
        const idx = newItems.findIndex(item => item.sku === sku);
        if (idx >= 0) {
          newItems.splice(idx, 1);
        }
        break;
      }
      case 'QuantityChanged': {
        const { sku, quantity } = event.payload as any;
        const idx = newItems.findIndex(item => item.sku === sku);
        if (idx >= 0) {
          if (quantity <= 0) {
            newItems.splice(idx, 1);
          } else {
            newItems[idx] = { ...newItems[idx], quantity };
          }
        }
        break;
      }
      case 'PriceUpdated': {
        const { sku, unitPrice } = event.payload as any;
        if (unitPrice < 0) {
          throw new EventStoreError("PriceUpdated unitPrice must be >= 0");
        }
        const idx = newItems.findIndex(item => item.sku === sku);
        if (idx >= 0) {
          newItems[idx] = { ...newItems[idx], unitPrice };
        }
        break;
      }
      case 'Cleared': {
        newItems.length = 0;
        break;
      }
    }

    newState.items = newItems;
    newState.totalAmount = newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    newState.eventCount = state.eventCount + 1;
    newState.lastVersion = event.version;

    return newState;
  };

  // Helper to project state from events
  const projectState = (aggregateId: string, events: DomainEvent[]): CartState => {
    let state = createEmptyState(aggregateId);

    for (const event of events) {
      state = applyEvent(state, event);
    }

    return state;
  };

  return {
    append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number {
      validateAggregateId(aggregateId);

      // Get existing events
      const events = eventsByAggregate.get(aggregateId) || [];
      const version = events.length + 1;

      // Validate payload based on type
      if (type === 'ItemAdded') {
        const { quantity, unitPrice } = payload as any;
        if (quantity < 1) {
          throw new EventStoreError("ItemAdded quantity must be >= 1");
        }
        if (unitPrice < 0) {
          throw new EventStoreError("ItemAdded unitPrice must be >= 0");
        }
      } else if (type === 'PriceUpdated') {
        const { unitPrice } = payload as any;
        if (unitPrice < 0) {
          throw new EventStoreError("PriceUpdated unitPrice must be >= 0");
        }
      }

      // Create and append event
      const event: DomainEvent = {
        type,
        aggregateId,
        payload: { ...payload },
        version,
        timestamp,
      };

      events.push(event);
      eventsByAggregate.set(aggregateId, events);

      // Auto-snapshot if needed
      if (version % config.snapshotEvery === 0) {
        const state = projectState(aggregateId, events);
        const snapshot: Snapshot = {
          aggregateId,
          state,
          atVersion: version,
          takenAt: timestamp,
        };
        snapshotsByAggregate.set(aggregateId, snapshot);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      validateAggregateId(aggregateId);

      const events = eventsByAggregate.get(aggregateId) || [];

      // Check for snapshot
      const snapshot = snapshotsByAggregate.get(aggregateId);
      if (snapshot) {
        // Project from snapshot
        const eventsAfterSnapshot = events.filter(e => e.version > snapshot.atVersion);
        let state: CartState = {
          ...snapshot.state,
          items: snapshot.state.items.slice(),
        };
        for (const event of eventsAfterSnapshot) {
          state = applyEvent(state, event);
        }
        return state;
      } else {
        // Project from scratch
        return projectState(aggregateId, events);
      }
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      validateAggregateId(aggregateId);

      const events = eventsByAggregate.get(aggregateId) || [];
      if (afterVersion === undefined) {
        return events.slice();
      }
      return events.filter(e => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      validateAggregateId(aggregateId);
      return snapshotsByAggregate.get(aggregateId) || null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      validateAggregateId(aggregateId);

      const state = this.getState(aggregateId);
      const snapshot: Snapshot = {
        aggregateId,
        state: {
          ...state,
          items: state.items.slice(),
        },
        atVersion: state.lastVersion,
        takenAt: Date.now(),
      };
      snapshotsByAggregate.set(aggregateId, snapshot);
      return snapshot;
    },

    getEventCount(aggregateId: string): number {
      validateAggregateId(aggregateId);
      const events = eventsByAggregate.get(aggregateId) || [];
      return events.length;
    },
  };
}