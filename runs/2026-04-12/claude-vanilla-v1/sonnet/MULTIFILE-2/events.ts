// ── Event System with Typed Events ──────────────────────────────────────────

export type EventType = 'user.created' | 'user.updated' | 'order.placed' | 'order.shipped'
  | 'payment.processed' | 'inventory.reserved'
  | 'fulfillment.started' | 'fulfillment.completed' | 'fulfillment.failed';

export interface DomainEvent<T extends EventType = EventType> {
  id: string;
  type: T;
  payload: Record<string, unknown>;
  timestamp: number;
  version: number;
}

export type EventHandler<T extends EventType> = (event: DomainEvent<T>) => void;

export function createEventBus(): {
  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
  publish(event: DomainEvent): void;
  getSubscriberCount(type: EventType): number;
} {
  const handlers = new Map<EventType, Set<EventHandler<any>>>();

  return {
    subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      const set = handlers.get(type)!;
      set.add(handler);

      return () => {
        set.delete(handler);
        if (set.size === 0) {
          handlers.delete(type);
        }
      };
    },

    publish(event: DomainEvent): void {
      const set = handlers.get(event.type);
      if (set) {
        for (const handler of set) {
          handler(event);
        }
      }
    },

    getSubscriberCount(type: EventType): number {
      const set = handlers.get(type);
      return set ? set.size : 0;
    },
  };
}