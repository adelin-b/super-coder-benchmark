import { Effect, Data, Exit, Cause } from "effect";

// ── Public Types ────────────────────────────────────────────────────────────

export type EventType =
  | "ItemAdded"
  | "ItemRemoved"
  | "QuantityChanged"
  | "PriceUpdated"
  | "Cleared";

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
    this.name = "EventStoreError";
    Object.setPrototypeOf(this, EventStoreError.prototype);
  }
}

// ── Internal Tagged Errors ───────────────────────────────────────────────────

class InternalError extends Data.TaggedError("InternalError")<{
  reason: string;
}> {}

// ── Projection Logic ─────────────────────────────────────────────────────────

function emptyState(id: string): CartState {
  return { id, items: [], totalAmount: 0, eventCount: 0, lastVersion: 0 };
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function applyEvent(state: CartState, event: DomainEvent): CartState {
  let items = state.items.map((i) => ({ ...i }));

  switch (event.type) {
    case "ItemAdded": {
      const sku = event.payload.sku as string;
      const quantity = event.payload.quantity as number;
      const unitPrice = event.payload.unitPrice as number;
      const existing = items.find((i) => i.sku === sku);
      if (existing) {
        existing.quantity += quantity;
      } else {
        items.push({ sku, quantity, unitPrice });
      }
      break;
    }
    case "ItemRemoved": {
      const sku = event.payload.sku as string;
      items = items.filter((i) => i.sku !== sku);
      break;
    }
    case "QuantityChanged": {
      const sku = event.payload.sku as string;
      const quantity = event.payload.quantity as number;
      const idx = items.findIndex((i) => i.sku === sku);
      if (idx !== -1) {
        if (quantity <= 0) {
          items.splice(idx, 1);
        } else {
          items[idx].quantity = quantity;
        }
      }
      break;
    }
    case "PriceUpdated": {
      const sku = event.payload.sku as string;
      const unitPrice = event.payload.unitPrice as number;
      const item = items.find((i) => i.sku === sku);
      if (item) {
        item.unitPrice = unitPrice;
      }
      break;
    }
    case "Cleared": {
      items = [];
      break;
    }
  }

  const totalAmount = recalcTotal(items);
  return {
    id: state.id,
    items,
    totalAmount,
    eventCount: state.eventCount + 1,
    lastVersion: event.version,
  };
}

function replayEvents(baseState: CartState, events: DomainEvent[]): CartState {
  return events.reduce((s, e) => applyEvent(s, e), baseState);
}

// ── Validation Effects ───────────────────────────────────────────────────────

const validateAppend = (
  aggregateId: string,
  type: EventType,
  payload: Record<string, unknown>
): Effect.Effect<void, InternalError> =>
  Effect.gen(function* () {
    if (!aggregateId || aggregateId.trim() === "") {
      yield* Effect.fail(
        new InternalError({ reason: "aggregateId must be non-empty" })
      );
    }

    if (type === "ItemAdded") {
      const quantity = payload.quantity as number;
      const unitPrice = payload.unitPrice as number;
      if (typeof quantity !== "number" || quantity < 1) {
        yield* Effect.fail(
          new InternalError({
            reason: "ItemAdded quantity must be >= 1",
          })
        );
      }
      if (typeof unitPrice !== "number" || unitPrice < 0) {
        yield* Effect.fail(
          new InternalError({
            reason: "ItemAdded unitPrice must be >= 0",
          })
        );
      }
    }

    if (type === "PriceUpdated") {
      const unitPrice = payload.unitPrice as number;
      if (typeof unitPrice !== "number" || unitPrice < 0) {
        yield* Effect.fail(
          new InternalError({
            reason: "PriceUpdated unitPrice must be >= 0",
          })
        );
      }
    }
  });

// ── Factory ──────────────────────────────────────────────────────────────────

export function createEventStore(config: { snapshotEvery: number }): {
  append(
    aggregateId: string,
    type: EventType,
    payload: Record<string, unknown>,
    timestamp: number
  ): number;
  getState(aggregateId: string): CartState;
  getEvents(aggregateId: string, afterVersion?: number): DomainEvent[];
  getSnapshot(aggregateId: string): Snapshot | null;
  takeSnapshot(aggregateId: string): Snapshot;
  getEventCount(aggregateId: string): number;
} {
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const eventsByAggregate = new Map<string, DomainEvent[]>();
  const snapshotByAggregate = new Map<string, Snapshot>();

  function ensureAggregate(aggregateId: string): void {
    if (!eventsByAggregate.has(aggregateId)) {
      eventsByAggregate.set(aggregateId, []);
    }
  }

  function computeCurrentState(aggregateId: string): CartState {
    const events = eventsByAggregate.get(aggregateId) ?? [];
    const snapshot = snapshotByAggregate.get(aggregateId) ?? null;

    if (snapshot) {
      const subsequent = events.filter((e) => e.version > snapshot.atVersion);
      // Deep-clone snapshot state items to avoid mutation
      const base: CartState = {
        ...snapshot.state,
        items: snapshot.state.items.map((i) => ({ ...i })),
      };
      return replayEvents(base, subsequent);
    }

    return replayEvents(emptyState(aggregateId), events);
  }

  return {
    append(
      aggregateId: string,
      type: EventType,
      payload: Record<string, unknown>,
      timestamp: number
    ): number {
      // Validate
      const exit = Effect.runSyncExit(
        validateAppend(aggregateId, type, payload)
      );
      if (Exit.isFailure(exit)) {
        const raw = Cause.squash(exit.cause);
        const msg =
          raw instanceof Error
            ? raw.message
            : (raw as any).reason ?? String(raw);
        throw new EventStoreError(msg);
      }

      ensureAggregate(aggregateId);
      const events = eventsByAggregate.get(aggregateId)!;
      const version = events.length + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload,
        version,
        timestamp,
      };
      events.push(event);

      // Auto-snapshot
      if (version % config.snapshotEvery === 0) {
        const state = computeCurrentState(aggregateId);
        const snap: Snapshot = {
          aggregateId,
          state: { ...state, items: state.items.map((i) => ({ ...i })) },
          atVersion: version,
          takenAt: timestamp,
        };
        snapshotByAggregate.set(aggregateId, snap);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be non-empty");
      }
      if (!eventsByAggregate.has(aggregateId)) {
        return emptyState(aggregateId);
      }
      return computeCurrentState(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      const events = eventsByAggregate.get(aggregateId) ?? [];
      if (afterVersion === undefined) {
        return [...events];
      }
      return events.filter((e) => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      return snapshotByAggregate.get(aggregateId) ?? null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be non-empty");
      }
      ensureAggregate(aggregateId);
      const state = computeCurrentState(aggregateId);
      const events = eventsByAggregate.get(aggregateId)!;
      const atVersion = events.length > 0 ? events[events.length - 1].version : 0;
      const takenAt = events.length > 0 ? events[events.length - 1].timestamp : Date.now();

      const snap: Snapshot = {
        aggregateId,
        state: { ...state, items: state.items.map((i) => ({ ...i })) },
        atVersion,
        takenAt,
      };
      snapshotByAggregate.set(aggregateId, snap);
      return snap;
    },

    getEventCount(aggregateId: string): number {
      return (eventsByAggregate.get(aggregateId) ?? []).length;
    },
  };
}