import { Effect, Data, Exit, Cause } from "effect";

// ─── Public Types ────────────────────────────────────────────────────────────

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

// ─── Internal Tagged Errors ──────────────────────────────────────────────────

class InternalValidationError extends Data.TaggedError("InternalValidationError")<{
  reason: string;
}> {}

// ─── Projection Logic ────────────────────────────────────────────────────────

function emptyState(id: string): CartState {
  return { id, items: [], totalAmount: 0, eventCount: 0, lastVersion: 0 };
}

function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

function applyEvent(state: CartState, event: DomainEvent): CartState {
  let items = state.items.map((i) => ({ ...i }));
  const p = event.payload;

  switch (event.type) {
    case "ItemAdded": {
      const sku = p.sku as string;
      const qty = p.quantity as number;
      const price = p.unitPrice as number;
      const idx = items.findIndex((i) => i.sku === sku);
      if (idx >= 0) {
        items[idx].quantity += qty;
      } else {
        items.push({ sku, quantity: qty, unitPrice: price });
      }
      break;
    }
    case "ItemRemoved": {
      const sku = p.sku as string;
      items = items.filter((i) => i.sku !== sku);
      break;
    }
    case "QuantityChanged": {
      const sku = p.sku as string;
      const qty = p.quantity as number;
      const idx = items.findIndex((i) => i.sku === sku);
      if (idx >= 0) {
        if (qty <= 0) {
          items = items.filter((i) => i.sku !== sku);
        } else {
          items[idx].quantity = qty;
        }
      }
      break;
    }
    case "PriceUpdated": {
      const sku = p.sku as string;
      const price = p.unitPrice as number;
      const idx = items.findIndex((i) => i.sku === sku);
      if (idx >= 0) {
        items[idx].unitPrice = price;
      }
      break;
    }
    case "Cleared": {
      items = [];
      break;
    }
  }

  return {
    id: state.id,
    items,
    totalAmount: calcTotal(items),
    eventCount: state.eventCount + 1,
    lastVersion: event.version,
  };
}

function replayEvents(base: CartState, events: DomainEvent[]): CartState {
  return events.reduce((s, e) => applyEvent(s, e), base);
}

// ─── Internal Effect-based Logic ─────────────────────────────────────────────

const validateConfig = (snapshotEvery: number): Effect.Effect<void, InternalValidationError> =>
  Effect.gen(function* () {
    if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
      yield* Effect.fail(
        new InternalValidationError({ reason: "snapshotEvery must be >= 1" })
      );
    }
  });

const validateAggregateId = (id: string): Effect.Effect<void, InternalValidationError> =>
  Effect.gen(function* () {
    if (!id || typeof id !== "string" || id.trim() === "") {
      yield* Effect.fail(
        new InternalValidationError({ reason: "aggregateId must be a non-empty string" })
      );
    }
  });

const validatePayload = (
  type: EventType,
  payload: Record<string, unknown>
): Effect.Effect<void, InternalValidationError> =>
  Effect.gen(function* () {
    if (type === "ItemAdded") {
      const qty = payload.quantity as number;
      const price = payload.unitPrice as number;
      if (typeof qty !== "number" || qty < 1) {
        yield* Effect.fail(
          new InternalValidationError({ reason: "ItemAdded quantity must be >= 1" })
        );
      }
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new InternalValidationError({ reason: "ItemAdded unitPrice must be >= 0" })
        );
      }
    }
    if (type === "PriceUpdated") {
      const price = payload.unitPrice as number;
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new InternalValidationError({ reason: "PriceUpdated unitPrice must be >= 0" })
        );
      }
    }
  });

// ─── Factory ─────────────────────────────────────────────────────────────────

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
  // Validate config at creation time
  const configExit = Effect.runSyncExit(validateConfig(config.snapshotEvery));
  if (Exit.isFailure(configExit)) {
    const raw = Cause.squash(configExit.cause);
    const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
    throw new EventStoreError(msg);
  }

  const { snapshotEvery } = config;

  // Internal storage
  const eventStore = new Map<string, DomainEvent[]>();
  const snapshotStore = new Map<string, Snapshot>();

  function getEventsInternal(aggregateId: string, afterVersion?: number): DomainEvent[] {
    const events = eventStore.get(aggregateId) ?? [];
    if (afterVersion === undefined || afterVersion === null) return events;
    return events.filter((e) => e.version > afterVersion);
  }

  function computeState(aggregateId: string): CartState {
    const snapshot = snapshotStore.get(aggregateId) ?? null;
    const base = snapshot ? { ...snapshot.state, items: snapshot.state.items.map((i) => ({ ...i })) } : emptyState(aggregateId);
    const afterVersion = snapshot ? snapshot.atVersion : undefined;
    const events = getEventsInternal(aggregateId, afterVersion);
    return replayEvents(base, events);
  }

  function takeSnapshotInternal(aggregateId: string, timestamp?: number): Snapshot {
    const state = computeState(aggregateId);
    const snap: Snapshot = {
      aggregateId,
      state,
      atVersion: state.lastVersion,
      takenAt: timestamp ?? Date.now(),
    };
    snapshotStore.set(aggregateId, snap);
    return snap;
  }

  return {
    append(
      aggregateId: string,
      type: EventType,
      payload: Record<string, unknown>,
      timestamp: number
    ): number {
      // Validate
      const idExit = Effect.runSyncExit(validateAggregateId(aggregateId));
      if (Exit.isFailure(idExit)) {
        const raw = Cause.squash(idExit.cause);
        const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
        throw new EventStoreError(msg);
      }

      const payloadExit = Effect.runSyncExit(validatePayload(type, payload));
      if (Exit.isFailure(payloadExit)) {
        const raw = Cause.squash(payloadExit.cause);
        const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
        throw new EventStoreError(msg);
      }

      if (!eventStore.has(aggregateId)) {
        eventStore.set(aggregateId, []);
      }

      const events = eventStore.get(aggregateId)!;
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
      if (version % snapshotEvery === 0) {
        takeSnapshotInternal(aggregateId, timestamp);
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!eventStore.has(aggregateId) && !snapshotStore.has(aggregateId)) {
        return emptyState(aggregateId);
      }
      return computeState(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      return getEventsInternal(aggregateId, afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      return snapshotStore.get(aggregateId) ?? null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      return takeSnapshotInternal(aggregateId);
    },

    getEventCount(aggregateId: string): number {
      return (eventStore.get(aggregateId) ?? []).length;
    },
  };
}