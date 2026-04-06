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
}) {
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const events = new Map<string, DomainEvent[]>();
  const snapshots = new Map<string, Snapshot>();

  const applyEventsToState = (
    aggregateId: string,
    baseItems: Map<string, CartItem>,
    eventsToApply: DomainEvent[],
    baseVersion: number
  ): { items: Map<string, CartItem>; lastVersion: number } => {
    let lastVersion = baseVersion;

    for (const event of eventsToApply) {
      lastVersion = event.version;

      switch (event.type) {
        case 'ItemAdded': {
          const { sku, quantity, unitPrice } = event.payload as {
            sku: string;
            quantity: number;
            unitPrice: number;
          };
          const existing = baseItems.get(sku);
          if (existing) {
            existing.quantity += quantity;
          } else {
            baseItems.set(sku, { sku, quantity, unitPrice });
          }
          break;
        }
        case 'ItemRemoved': {
          const { sku } = event.payload as { sku: string };
          baseItems.delete(sku);
          break;
        }
        case 'QuantityChanged': {
          const { sku, quantity } = event.payload as {
            sku: string;
            quantity: number;
          };
          if (quantity <= 0) {
            baseItems.delete(sku);
          } else {
            const item = baseItems.get(sku);
            if (item) {
              item.quantity = quantity;
            }
          }
          break;
        }
        case 'PriceUpdated': {
          const { sku, unitPrice } = event.payload as {
            sku: string;
            unitPrice: number;
          };
          const item = baseItems.get(sku);
          if (item) {
            item.unitPrice = unitPrice;
          }
          break;
        }
        case 'Cleared': {
          baseItems.clear();
          break;
        }
      }
    }

    return { items: baseItems, lastVersion };
  };

  return {
    append(aggregateId: string, type: EventType, payload: Record<string, unknown>, timestamp: number): number {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

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

      if (!events.has(aggregateId)) {
        events.set(aggregateId, []);
      }
      const aggEvents = events.get(aggregateId)!;
      const version = aggEvents.length + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload,
        version,
        timestamp,
      };
      aggEvents.push(event);

      if (version % config.snapshotEvery === 0) {
        const snapshot = this.takeSnapshot(aggregateId);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

      const snapshot = snapshots.get(aggregateId);
      const aggEvents = events.get(aggregateId) || [];

      let items = new Map<string, CartItem>();
      let baseVersion = 0;
      let eventsToApply: DomainEvent[];

      if (snapshot) {
        for (const item of snapshot.state.items) {
          items.set(item.sku, { ...item });
        }
        baseVersion = snapshot.atVersion;
        eventsToApply = aggEvents.filter(e => e.version > snapshot.atVersion);
      } else {
        eventsToApply = aggEvents;
      }

      if (eventsToApply.length > 0) {
        const result = applyEventsToState(aggregateId, items, eventsToApply, baseVersion);
        items = result.items;
        baseVersion = result.lastVersion;
      }

      const itemsList = Array.from(items.values());
      const totalAmount = itemsList.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      return {
        id: aggregateId,
        items: itemsList,
        totalAmount,
        eventCount: aggEvents.length,
        lastVersion: baseVersion,
      };
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

      const aggEvents = events.get(aggregateId) || [];

      if (afterVersion === undefined) {
        return aggEvents;
      }

      return aggEvents.filter(e => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

      return snapshots.get(aggregateId) || null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

      const aggEvents = events.get(aggregateId) || [];
      if (aggEvents.length === 0) {
        throw new EventStoreError("Cannot take snapshot: no events for aggregate");
      }

      const state = this.getState(aggregateId);
      const lastEvent = aggEvents[aggEvents.length - 1];

      const snapshot: Snapshot = {
        aggregateId,
        state,
        atVersion: lastEvent.version,
        takenAt: lastEvent.timestamp,
      };

      snapshots.set(aggregateId, snapshot);
      return snapshot;
    },

    getEventCount(aggregateId: string): number {
      if (!aggregateId || aggregateId.trim().length === 0) {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }

      return (events.get(aggregateId) || []).length;
    },
  };
}