import { Effect, Data, Exit, Cause } from "effect";

// ── Exported Types ──────────────────────────────────────────────────────────

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

// ── Internal Tagged Errors ───────────────────────────────────────────────────

class ValidationError extends Data.TaggedError("ValidationError")<{
  reason: string;
}> {}

// ── Projection Logic ─────────────────────────────────────────────────────────

function emptyState(id: string): CartState {
  return { id, items: [], totalAmount: 0, eventCount: 0, lastVersion: 0 };
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
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

// ── Validation Effects ────────────────────────────────────────────────────────

const validateAppend = (
  aggregateId: string,
  type: EventType,
  payload: Record<string, unknown>
): Effect.Effect<void, ValidationError> =>
  Effect.gen(function* () {
    if (!aggregateId || aggregateId.trim() === "") {
      yield* Effect.fail(
        new ValidationError({ reason: "aggregateId must be a non-empty string" })
      );
    }
    if (type === "ItemAdded") {
      const quantity = payload.quantity as number;
      const unitPrice = payload.unitPrice as number;
      if (typeof quantity !== "number" || quantity < 1) {
        yield* Effect.fail(
          new ValidationError({
            reason: "ItemAdded: quantity must be >= 1",
          })
        );
      }
      if (typeof unitPrice !== "number" || unitPrice < 0) {
        yield* Effect.fail(
          new ValidationError({
            reason: "ItemAdded: unitPrice must be >= 0",
          })
        );
      }
    }
    if (type === "PriceUpdated") {
      const unitPrice = payload.unitPrice as number;
      if (typeof unitPrice !== "number" || unitPrice < 0) {
        yield* Effect.fail(
          new ValidationError({
            reason: "PriceUpdated: unitPrice must be >= 0",
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
  if (config.snapshotEvery < 1) {
    throw new EventStoreError("snapshotEvery must be >= 1");
  }

  const eventLog = new Map<string, DomainEvent[]>();
  const snapshots = new Map<string, Snapshot>();

  function ensureAggregate(aggregateId: string): void {
    if (!eventLog.has(aggregateId)) {
      eventLog.set(aggregateId, []);
    }
  }

  function projectFromScratch(aggregateId: string): CartState {
    const events = eventLog.get(aggregateId) ?? [];
    return replayEvents(emptyState(aggregateId), events);
  }

  function projectFromSnapshot(aggregateId: string): CartState {
    const snap = snapshots.get(aggregateId);
    const allEvents = eventLog.get(aggregateId) ?? [];
    if (!snap) {
      return replayEvents(emptyState(aggregateId), allEvents);
    }
    const subsequent = allEvents.filter((e) => e.version > snap.atVersion);
    return replayEvents(snap.state, subsequent);
  }

  return {
    append(
      aggregateId: string,
      type: EventType,
      payload: Record<string, unknown>,
      timestamp: number
    ): number {
      // Validation
      const validationExit = Effect.runSyncExit(
        validateAppend(aggregateId, type, payload)
      );
      if (Exit.isFailure(validationExit)) {
        const err = Cause.squash(validationExit.cause);
        throw new EventStoreError(
          err instanceof Error ? err.message : String(err)
        );
      }

      ensureAggregate(aggregateId);
      const events = eventLog.get(aggregateId)!;
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
        const state = projectFromScratch(aggregateId);
        snapshots.set(aggregateId, {
          aggregateId,
          state,
          atVersion: version,
          takenAt: timestamp,
        });
      }

      return version;
    },

    getState(aggregateId: string): CartState {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }
      if (!eventLog.has(aggregateId)) {
        return emptyState(aggregateId);
      }
      return projectFromSnapshot(aggregateId);
    },

    getEvents(aggregateId: string, afterVersion?: number): DomainEvent[] {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }
      const events = eventLog.get(aggregateId) ?? [];
      if (afterVersion === undefined) return [...events];
      return events.filter((e) => e.version > afterVersion);
    },

    getSnapshot(aggregateId: string): Snapshot | null {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }
      return snapshots.get(aggregateId) ?? null;
    },

    takeSnapshot(aggregateId: string): Snapshot {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }
      ensureAggregate(aggregateId);
      const state = projectFromScratch(aggregateId);
      const events = eventLog.get(aggregateId)!;
      const atVersion = events.length > 0 ? events[events.length - 1].version : 0;
      const takenAt = events.length > 0 ? events[events.length - 1].timestamp : Date.now();
      const snap: Snapshot = { aggregateId, state, atVersion, takenAt };
      snapshots.set(aggregateId, snap);
      return snap;
    },

    getEventCount(aggregateId: string): number {
      if (!aggregateId || aggregateId.trim() === "") {
        throw new EventStoreError("aggregateId must be a non-empty string");
      }
      return (eventLog.get(aggregateId) ?? []).length;
    },
  };
}