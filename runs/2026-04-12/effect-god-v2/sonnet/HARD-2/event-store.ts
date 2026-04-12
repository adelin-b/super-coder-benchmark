import { Effect, Data, Exit, Cause } from "effect";

// ─── Exported Types ───────────────────────────────────────────────────────────

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
  }
}

// ─── Internal Tagged Errors ───────────────────────────────────────────────────

class StoreValidationError extends Data.TaggedError("StoreValidationError")<{
  reason: string;
}> {}

// ─── Projection Logic ─────────────────────────────────────────────────────────

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
      const qty = event.payload.quantity as number;
      const price = event.payload.unitPrice as number;
      const existing = items.find((i) => i.sku === sku);
      if (existing) {
        existing.quantity += qty;
      } else {
        items.push({ sku, quantity: qty, unitPrice: price });
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
      const qty = event.payload.quantity as number;
      const existing = items.find((i) => i.sku === sku);
      if (existing) {
        if (qty <= 0) {
          items = items.filter((i) => i.sku !== sku);
        } else {
          existing.quantity = qty;
        }
      }
      break;
    }
    case "PriceUpdated": {
      const sku = event.payload.sku as string;
      const price = event.payload.unitPrice as number;
      const existing = items.find((i) => i.sku === sku);
      if (existing) {
        existing.unitPrice = price;
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

function replayEvents(base: CartState, events: DomainEvent[]): CartState {
  return events.reduce((s, e) => applyEvent(s, e), base);
}

// ─── Internal Effect-based Validation ────────────────────────────────────────

const validateAppend = (
  aggregateId: string,
  type: EventType,
  payload: Record<string, unknown>
): Effect.Effect<void, StoreValidationError> =>
  Effect.gen(function* () {
    if (!aggregateId || aggregateId.trim() === "") {
      yield* Effect.fail(
        new StoreValidationError({ reason: "aggregateId must be non-empty" })
      );
    }

    if (type === "ItemAdded") {
      const qty = payload.quantity as number;
      const price = payload.unitPrice as number;
      if (typeof qty !== "number" || qty < 1) {
        yield* Effect.fail(
          new StoreValidationError({
            reason: "ItemAdded quantity must be >= 1",
          })
        );
      }
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new StoreValidationError({
            reason: "ItemAdded unitPrice must be >= 0",
          })
        );
      }
    }

    if (type === "PriceUpdated") {
      const price = payload.unitPrice as number;
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new StoreValidationError({
            reason: "PriceUpdated unitPrice must be >= 0",
          })
        );
      }
    }
  });

// ─── Factory ──────────────────────────────────────────────────────────────────

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

  const events = new Map<string, DomainEvent[]>();
  const snapshots = new Map<string, Snapshot>();

  function ensureAggregate(id: string): void {
    if (!events.has(id)) {
      events.set(id, []);
    }
  }

  function computeState(aggregateId: string): CartState {
    const snap = snapshots.get(aggregateId) ?? null;
    const allEvents = events.get(aggregateId) ?? [];

    if (snap === null) {
      return replayEvents(emptyState(aggregateId), allEvents);
    }

    const afterSnap = allEvents.filter((e) => e.version > snap.atVersion);
    // Deep-clone snapshot state to avoid mutation
    const baseState: CartState = {
      ...snap.state,
      items: snap.state.items.map((i) => ({ ...i })),
    };
    return replayEvents(baseState, afterSnap);
  }

  return {
    append(
      aggregateId: string,
      type: EventType,
      payload: Record<string, unknown>,
      timestamp: number
    ): number {
      // Validate
      const exit = Exit.runSync(
        Effect.exit(validateAppend(aggregateId, type, payload))
      );
      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause);
        if (err instanceof StoreValidationError) {
          throw new EventStoreError(err.reason);
        }
        throw new EventStoreError(String(err));
      }

      ensureAggregate(aggregateId);
      const agg = events.get(aggregateId)!;
      const version = agg.length + 1;

      const event: DomainEvent = {
        type,
        aggregateId,
        payload,
        version,
        timestamp,
      };
      agg.push(event);

      // Auto-snapshot
      if (version % config.snapshotEvery === 0) {
        const state = computeState(aggregateId);
        const snap: Snapshot = {
          aggregateId,
          state: { ...state, items: state.items.map((i) => ({ ...i })) },
          atVersion: version,
          takenAt: timestamp,
        };
        snapshots.set(aggregateId, snap);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be non-empty");
      }
      if (!events.has(aggregateId)) {
        return emptyState(aggregateId);
      }
      return computeState(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      const agg = events.get(aggregateId) ?? [];
      if (afterVersion === undefined) return [...agg];
      return agg.filter((e) => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      return snapshots.get(aggregateId) ?? null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be non-empty");
      }
      ensureAggregate(aggregateId);
      const state = computeState(aggregateId);
      const snap: Snapshot = {
        aggregateId,
        state: { ...state, items: state.items.map((i) => ({ ...i })) },
        atVersion: state.lastVersion,
        takenAt: Date.now(),
      };
      snapshots.set(aggregateId, snap);
      return snap;
    },

    getEventCount(aggregateId: string): number {
      return (events.get(aggregateId) ?? []).length;
    },
  };
}