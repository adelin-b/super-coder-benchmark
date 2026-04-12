import { Effect, Data, Exit, Cause } from "effect";

// ── Public Types ──────────────────────────────────────────────────────────────

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

// ── Internal Tagged Errors ────────────────────────────────────────────────────

class InternalError extends Data.TaggedError("InternalError")<{
  reason: string;
}> {}

// ── Projection Logic ──────────────────────────────────────────────────────────

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

function replayEvents(baseState: CartState, events: DomainEvent[]): CartState {
  return events.reduce((s, e) => applyEvent(s, e), baseState);
}

// ── Validation (Effect) ───────────────────────────────────────────────────────

const validateAppend = (
  aggregateId: string,
  type: EventType,
  payload: Record<string, unknown>
): Effect.Effect<void, InternalError> =>
  Effect.gen(function* () {
    if (!aggregateId || aggregateId.trim() === "") {
      yield* Effect.fail(
        new InternalError({ reason: "aggregateId must be a non-empty string" })
      );
    }

    if (type === "ItemAdded") {
      const qty = payload.quantity as number;
      const price = payload.unitPrice as number;
      if (typeof qty !== "number" || qty < 1) {
        yield* Effect.fail(
          new InternalError({
            reason: "ItemAdded quantity must be >= 1",
          })
        );
      }
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new InternalError({
            reason: "ItemAdded unitPrice must be >= 0",
          })
        );
      }
    }

    if (type === "PriceUpdated") {
      const price = payload.unitPrice as number;
      if (typeof price !== "number" || price < 0) {
        yield* Effect.fail(
          new InternalError({
            reason: "PriceUpdated unitPrice must be >= 0",
          })
        );
      }
    }
  });

// ── Factory ───────────────────────────────────────────────────────────────────

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
  if (!config || config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const { snapshotEvery } = config;

  // Per-aggregate storage
  const eventsMap = new Map<string, DomainEvent[]>();
  const snapshotMap = new Map<string, Snapshot>();

  function ensureAggregate(aggregateId: string): DomainEvent[] {
    if (!eventsMap.has(aggregateId)) {
      eventsMap.set(aggregateId, []);
    }
    return eventsMap.get(aggregateId)!;
  }

  function computeState(aggregateId: string): CartState {
    const events = eventsMap.get(aggregateId) ?? [];
    const snap = snapshotMap.get(aggregateId) ?? null;

    if (events.length === 0) {
      if (snap) {
        // snapshot exists but no events after... use snapshot state
        return { ...snap.state };
      }
      return emptyState(aggregateId);
    }

    if (snap) {
      const subsequent = events.filter((e) => e.version > snap.atVersion);
      const base: CartState = { ...snap.state, items: snap.state.items.map((i) => ({ ...i })) };
      return replayEvents(base, subsequent);
    }

    return replayEvents(emptyState(aggregateId), events);
  }

  function append(
    aggregateId: string,
    type: EventType,
    payload: Record<string, unknown>,
    timestamp: number
  ): number {
    // Validate via Effect
    const validationExit = Effect.runSyncExit(
      validateAppend(aggregateId, type, payload)
    );
    if (Exit.isFailure(validationExit)) {
      const raw = Cause.squash(validationExit.cause);
      const msg =
        raw instanceof Error
          ? raw.message
          : (raw as any).reason ?? String(raw);
      throw new EventStoreError(msg);
    }

    const events = ensureAggregate(aggregateId);
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
      const state = computeState(aggregateId);
      const snap: Snapshot = {
        aggregateId,
        state: { ...state, items: state.items.map((i) => ({ ...i })) },
        atVersion: version,
        takenAt: timestamp,
      };
      snapshotMap.set(aggregateId, snap);
    }

    return version;
  }

  function getState(aggregateId: string): CartState {
    if (!aggregateId || aggregateId.trim() === "") {
      throw new EventStoreError("aggregateId must be a non-empty string");
    }
    if (!eventsMap.has(aggregateId)) {
      return emptyState(aggregateId);
    }
    return computeState(aggregateId);
  }

  function getEvents(
    aggregateId: string,
    afterVersion?: number
  ): DomainEvent[] {
    const events = eventsMap.get(aggregateId) ?? [];
    if (afterVersion === undefined) {
      return [...events];
    }
    return events.filter((e) => e.version > afterVersion);
  }

  function getSnapshot(aggregateId: string): Snapshot | null {
    return snapshotMap.get(aggregateId) ?? null;
  }

  function takeSnapshot(aggregateId: string): Snapshot {
    if (!aggregateId || aggregateId.trim() === "") {
      throw new EventStoreError("aggregateId must be a non-empty string");
    }
    ensureAggregate(aggregateId);
    const state = computeState(aggregateId);
    const snap: Snapshot = {
      aggregateId,
      state: { ...state, items: state.items.map((i) => ({ ...i })) },
      atVersion: state.lastVersion,
      takenAt: Date.now(),
    };
    snapshotMap.set(aggregateId, snap);
    return snap;
  }

  function getEventCount(aggregateId: string): number {
    return (eventsMap.get(aggregateId) ?? []).length;
  }

  return {
    append,
    getState,
    getEvents,
    getSnapshot,
    takeSnapshot,
    getEventCount,
  };
}