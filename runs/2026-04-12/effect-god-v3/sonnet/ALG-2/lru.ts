import { Effect, Data } from "effect";

// ─── Internal tagged errors ───────────────────────────────────────────────────

class CapacityError extends Data.TaggedError("CapacityError")<{
  reason: string;
}> {}

// ─── Doubly-linked list node ──────────────────────────────────────────────────

interface Node {
  key: number;
  value: number;
  prev: Node | null;
  next: Node | null;
}

function makeNode(key: number, value: number): Node {
  return { key, value, prev: null, next: null };
}

// ─── Internal Effect-based logic ──────────────────────────────────────────────

interface CacheState {
  capacity: number;
  map: Map<number, Node>;
  head: Node; // dummy head (MRU side)
  tail: Node; // dummy tail (LRU side)
}

function makeState(capacity: number): CacheState {
  const head = makeNode(0, 0);
  const tail = makeNode(0, 0);
  head.next = tail;
  tail.prev = head;
  return { capacity, map: new Map(), head, tail };
}

function removeNode(node: Node): void {
  const prev = node.prev!;
  const next = node.next!;
  prev.next = next;
  next.prev = prev;
}

function insertAfterHead(state: CacheState, node: Node): void {
  node.prev = state.head;
  node.next = state.head.next;
  state.head.next!.prev = node;
  state.head.next = node;
}

const internalGet = (
  state: CacheState,
  key: number
): Effect.Effect<number, never> =>
  Effect.sync(() => {
    const node = state.map.get(key);
    if (node === undefined) return -1;
    // Move to MRU position
    removeNode(node);
    insertAfterHead(state, node);
    return node.value;
  });

const internalPut = (
  state: CacheState,
  key: number,
  value: number
): Effect.Effect<void, CapacityError> =>
  Effect.gen(function* () {
    if (state.capacity <= 0) {
      yield* Effect.fail(new CapacityError({ reason: "capacity must be > 0" }));
    }

    const existing = state.map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      removeNode(existing);
      insertAfterHead(state, existing);
      return;
    }

    // Evict LRU if at capacity
    if (state.map.size >= state.capacity) {
      const lru = state.tail.prev!;
      removeNode(lru);
      state.map.delete(lru.key);
    }

    const node = makeNode(key, value);
    state.map.set(key, node);
    insertAfterHead(state, node);
  });

// ─── Public error class ───────────────────────────────────────────────────────

export class LRUCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LRUCacheError";
    Object.setPrototypeOf(this, LRUCacheError.prototype);
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface LRUCache {
  /**
   * Returns the value for `key`, or `-1` if not present.
   * Marks the entry as most-recently used.
   */
  get(key: number): number;

  /**
   * Inserts or updates `key → value`.
   * If the cache is at capacity, evicts the least-recently-used entry first.
   */
  put(key: number, value: number): void;

  /** Current number of entries stored. */
  size(): number;

  /** The fixed maximum number of entries this cache can hold. */
  readonly capacity: number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createLRUCache(capacity: number): LRUCache {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new LRUCacheError("capacity must be a positive integer");
  }

  const state = makeState(capacity);

  return {
    get capacity() {
      return state.capacity;
    },

    get(key: number): number {
      const exit = Effect.runSyncExit(internalGet(state, key));
      // internalGet never fails
      if (exit._tag === "Failure") return -1;
      return exit.value;
    },

    put(key: number, value: number): void {
      const exit = Effect.runSyncExit(internalPut(state, key, value));
      if (exit._tag === "Failure") {
        const { Cause } = require("effect") as typeof import("effect");
        const raw = Cause.squash(exit.cause);
        const msg =
          raw instanceof Error
            ? raw.message
            : (raw as CapacityError).reason ?? String(raw);
        throw new LRUCacheError(msg);
      }
    },

    size(): number {
      return state.map.size;
    },
  };
}

// ─── Class-based API (mirrors standard LeetCode / interview style) ─────────────

export class LRUCacheClass implements LRUCache {
  readonly capacity: number;
  private _state: CacheState;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new LRUCacheError("capacity must be a positive integer");
    }
    this.capacity = capacity;
    this._state = makeState(capacity);
  }

  get(key: number): number {
    const exit = Effect.runSyncExit(internalGet(this._state, key));
    if (exit._tag === "Failure") return -1;
    return exit.value;
  }

  put(key: number, value: number): void {
    const exit = Effect.runSyncExit(internalPut(this._state, key, value));
    if (exit._tag === "Failure") {
      const { Cause } = require("effect") as typeof import("effect");
      const raw = Cause.squash(exit.cause);
      const msg =
        raw instanceof Error
          ? raw.message
          : (raw as CapacityError).reason ?? String(raw);
      throw new LRUCacheError(msg);
    }
  }

  size(): number {
    return this._state.map.size;
  }
}