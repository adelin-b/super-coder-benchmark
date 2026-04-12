import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain Errors ────────────────────────────────────────────────────────────

class CapacityError extends Data.TaggedError("CapacityError")<{
  reason: string;
}> {}

// ─── Internal Doubly-Linked List Node ─────────────────────────────────────────

interface DLNode<K, V> {
  key: K;
  value: V;
  prev: DLNode<K, V> | null;
  next: DLNode<K, V> | null;
}

function makeNode<K, V>(key: K, value: V): DLNode<K, V> {
  return { key, value, prev: null, next: null };
}

// ─── Internal Effect-based Core ───────────────────────────────────────────────

function makeInternalCache<K, V>(capacity: number) {
  const map = new Map<K, DLNode<K, V>>();

  // Sentinel head (MRU side) and tail (LRU side)
  const head: DLNode<K, V> = makeNode(null as unknown as K, null as unknown as V);
  const tail: DLNode<K, V> = makeNode(null as unknown as K, null as unknown as V);
  head.next = tail;
  tail.prev = head;

  function detach(node: DLNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  function insertAfterHead(node: DLNode<K, V>): void {
    node.next = head.next;
    node.prev = head;
    head.next!.prev = node;
    head.next = node;
  }

  function moveToFront(node: DLNode<K, V>): void {
    detach(node);
    insertAfterHead(node);
  }

  const internalGet = (key: K): Effect.Effect<V | undefined, never> =>
    Effect.sync(() => {
      const node = map.get(key);
      if (node === undefined) return undefined;
      moveToFront(node);
      return node.value;
    });

  const internalPut = (
    key: K,
    value: V
  ): Effect.Effect<void, CapacityError> =>
    Effect.gen(function* () {
      if (capacity <= 0) {
        yield* Effect.fail(
          new CapacityError({ reason: "Cache capacity must be > 0" })
        );
      }

      const existing = map.get(key);
      if (existing !== undefined) {
        existing.value = value;
        moveToFront(existing);
        return;
      }

      const node = makeNode(key, value);
      map.set(key, node);
      insertAfterHead(node);

      if (map.size > capacity) {
        // Evict LRU (node just before tail sentinel)
        const lru = tail.prev!;
        detach(lru);
        map.delete(lru.key);
      }
    });

  const internalDelete = (key: K): Effect.Effect<boolean, never> =>
    Effect.sync(() => {
      const node = map.get(key);
      if (node === undefined) return false;
      detach(node);
      map.delete(key);
      return true;
    });

  const internalClear = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      map.clear();
      head.next = tail;
      tail.prev = head;
    });

  const internalHas = (key: K): Effect.Effect<boolean, never> =>
    Effect.sync(() => map.has(key));

  const internalSize = (): Effect.Effect<number, never> =>
    Effect.sync(() => map.size);

  return {
    internalGet,
    internalPut,
    internalDelete,
    internalClear,
    internalHas,
    internalSize,
  };
}

// ─── Boundary Helpers ─────────────────────────────────────────────────────────

function runSync<A, E>(effect: Effect.Effect<A, E>): A {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
  return exit.value;
}

// ─── Public Export ────────────────────────────────────────────────────────────

export class LRUCache<K = string, V = unknown> {
  private readonly core: ReturnType<typeof makeInternalCache<K, V>>;
  private readonly _capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("LRUCache capacity must be a positive integer");
    }
    this._capacity = Math.floor(capacity);
    this.core = makeInternalCache<K, V>(this._capacity);
  }

  /**
   * Return the cached value for key, or undefined on a miss.
   * Marks the entry as most-recently used.
   */
  get(key: K): V | undefined {
    return runSync(this.core.internalGet(key));
  }

  /**
   * Insert or update key→value.
   * Evicts the least-recently-used entry when the cache is full.
   */
  put(key: K, value: V): void {
    runSync(this.core.internalPut(key, value));
  }

  /** Number of entries currently in the cache. */
  size(): number {
    return runSync(this.core.internalSize());
  }

  /** Whether the key exists in the cache (does NOT affect recency). */
  has(key: K): boolean {
    return runSync(this.core.internalHas(key));
  }

  /**
   * Remove a key from the cache.
   * Returns true if the key existed, false otherwise.
   */
  delete(key: K): boolean {
    return runSync(this.core.internalDelete(key));
  }

  /** Remove all entries. */
  clear(): void {
    runSync(this.core.internalClear());
  }

  /** The maximum number of entries this cache holds. */
  get capacity(): number {
    return this._capacity;
  }
}

// ─── Factory convenience ──────────────────────────────────────────────────────

export function createLRUCache<K = string, V = unknown>(
  capacity: number
): LRUCache<K, V> {
  return new LRUCache<K, V>(capacity);
}