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
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const aggregates = new Map<string, {
    events: DomainEvent[];
    snapshot: Snapshot | null;
  }>();

  function getOrCreateAggregate(aggregateId: string) {
    if (!aggregates.has(aggregateId)) {
      aggregates.set(aggregateId, {
        events: [],
        snapshot: null,
      });
    }
    return aggregates.get(aggregateId)!;
  }

  function validateAggregateId(aggregateId: string): void {
    if (typeof aggregateId !== 'string' || aggregateId.length === 0) {
      throw new EventStoreError("aggregateId must be a non-empty string");
    }
  }

  function applyEvent(state: CartState, event: DomainEvent): CartState {
    const itemMap = new Map(state.items.map(item => [item.sku, item]));

    switch (event.type) {
      case 'ItemAdded': {
        const { sku, quantity, unitPrice } = event.payload as {
          sku: string;
          quantity: number;
          unitPrice: number;
        };
        if (itemMap.has(sku)) {
          itemMap.get(sku)!.quantity += quantity;
        } else {
          itemMap.set(sku, { sku, quantity, unitPrice });
        }
        break;
      }
      case 'ItemRemoved': {
        const { sku } = event.payload as { sku: string };
        itemMap.delete(sku);
        break;
      }
      case 'QuantityChanged': {
        const { sku, quantity } = event.payload as { sku: string; quantity: number };
        if (itemMap.has(sku)) {
          if (quantity <= 0) {
            itemMap.delete(sku);
          } else {
            itemMap.get(sku)!.quantity = quantity;
          }
        }
        break;
      }
      case 'PriceUpdated': {
        const { sku, unitPrice } = event.payload as { sku: string; unitPrice: number };
        if (itemMap.has(sku)) {
          itemMap.get(sku)!.unitPrice = unitPrice;
        }
        break;
      }
      case 'Cleared': {
        itemMap.clear();
        break;
      }
    }

    const updatedItems = Array.from(itemMap.values());
    const totalAmount = updatedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    return {
      id: state.id,
      items: updatedItems,
      totalAmount,
      eventCount: state.eventCount,
      lastVersion: event.version,
    };
  }

  function replayFromSnapshot(
    aggregateId: string,
    snapshot: Snapshot | null,
    events: DomainEvent[]
  ): CartState {
    let state: CartState;

    if (snapshot) {
      state = {
        id: snapshot.state.id,
        items: [...snapshot.state.items],
        totalAmount: snapshot.state.totalAmount,
        eventCount: snapshot.state.eventCount,
        lastVersion: snapshot.state.lastVersion,
      };
      const eventsAfterSnapshot = events.filter(e => e.version > snapshot.atVersion);
      for (const event of eventsAfterSnapshot) {
        state = applyEvent(state, event);
      }
      state.eventCount = events.length;
    } else {
      state = {
        id: aggregateId,
        items: [],
        totalAmount: 0,
        eventCount: 0,
        lastVersion: 0,
      };
      for (const event of events) {
        state = applyEvent(state, event);
      }
      state.eventCount = events.length;
    }

    return state;
  }

  return {
    append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number {
      validateAggregateId(aggregateId);

      if (type === 'ItemAdded') {
        const quantity = (payload as any).quantity;
        const unitPrice = (payload as any).unitPrice;
        if (typeof quantity !== 'number' || quantity < 1) {
          throw new EventStoreError("ItemAdded quantity must be >= 1");
        }
        if (typeof unitPrice !== 'number' || unitPrice < 0) {
          throw new EventStoreError("ItemAdded unitPrice must be >= 0");
        }
      } else if (type === 'PriceUpdated') {
        const unitPrice = (payload as any).unitPrice;
        if (typeof unitPrice !== 'number' || unitPrice < 0) {
          throw new EventStoreError("PriceUpdated unitPrice must be >= 0");
        }
      }

      const aggregate = getOrCreateAggregate(aggregateId);
      const version = aggregate.events.length + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload,
        version,
        timestamp,
      };

      aggregate.events.push(event);

      if (version % config.snapshotEvery === 0) {
        const state = replayFromSnapshot(aggregateId, aggregate.snapshot, aggregate.events);
        aggregate.snapshot = {
          aggregateId,
          state,
          atVersion: version,
          takenAt: timestamp,
        };
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      validateAggregateId(aggregateId);

      const aggregate = aggregates.get(aggregateId);
      if (!aggregate) {
        return {
          id: aggregateId,
          items: [],
          totalAmount: 0,
          eventCount: 0,
          lastVersion: 0,
        };
      }

      return replayFromSnapshot(aggregateId, aggregate.snapshot, aggregate.events);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      validateAggregateId(aggregateId);

      const aggregate = aggregates.get(aggregateId);
      if (!aggregate) {
        return [];
      }

      if (afterVersion === undefined) {
        return [...aggregate.events];
      }

      return aggregate.events.filter(e => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      validateAggregateId(aggregateId);

      const aggregate = aggregates.get(aggregateId);
      return aggregate?.snapshot || null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      validateAggregateId(aggregateId);

      const aggregate = getOrCreateAggregate(aggregateId);
      const state = replayFromSnapshot(aggregateId, aggregate.snapshot, aggregate.events);

      const snapshot: Snapshot = {
        aggregateId,
        state,
        atVersion: state.lastVersion,
        takenAt: Date.now(),
      };

      aggregate.snapshot = snapshot;
      return snapshot;
    },

    getEventCount(aggregateId: string): number {
      validateAggregateId(aggregateId);

      const aggregate = aggregates.get(aggregateId);
      return aggregate?.events.length || 0;
    },
  };
}