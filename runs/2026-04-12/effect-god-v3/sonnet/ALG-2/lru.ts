import { Effect, Data } from "effect";

// ─── Internal types ───────────────────────────────────────────────────────────

interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

class CapacityError extends Data.TaggedError("CapacityError")<{
  reason: string;
}> {}

// ─── Doubly-linked list helpers ───────────────────────────────────────────────

function makeNode<K, V>(key: K, value: V): Node<K, V> {
  return { key, value, prev: null, next: null };
}

// ─── Public error class ───────────────────────────────────────────────────────

export class LRUError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LRUError";
    Object.setPrototypeOf(this, LRUError.prototype);
  }
}

// ─── LRUCache class ───────────────────────────────────────────────────────────

export class LRUCache<K = number, V = number> {
  private readonly capacity: number;
  private readonly map: Map<K, Node<K, V>>;
  /** Sentinel head (MRU side) */
  private readonly head: Node<K, V>;
  /** Sentinel tail (LRU side) */
  private readonly tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) throw new LRUError("Capacity must be a positive integer");

    this.capacity = capacity;
    this.map = new Map();

    // Sentinels – key/value are never accessed externally
    this.head = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
    this.tail = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // ── O(1) get ──────────────────────────────────────────────────────────────

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (node === undefined) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  // ── O(1) put ──────────────────────────────────────────────────────────────

  put(key: K, value: V): void {
    const existing = this.map.get(key);

    if (existing !== undefined) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    const node = makeNode(key, value);
    this.map.set(key, node);
    this.insertAtFront(node);

    if (this.map.size > this.capacity) {
      const lru = this.tail.prev!;
      this.removeNode(lru);
      this.map.delete(lru.key);
    }
  }

  // ── size ──────────────────────────────────────────────────────────────────

  size(): number {
    return this.map.size;
  }

  // ── has ───────────────────────────────────────────────────────────────────

  has(key: K): boolean {
    return this.map.has(key);
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private insertAtFront(node: Node<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: Node<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  private moveToFront(node: Node<K, V>): void {
    this.removeNode(node);
    this.insertAtFront(node);
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

export function createLRUCache<K = number, V = number>(
  capacity: number
): LRUCache<K, V> {
  return new LRUCache<K, V>(capacity);
}

// ─── Effect-based internal helpers (used for batch operations) ────────────────

const runBatchGet = <K, V>(
  cache: LRUCache<K, V>,
  keys: K[]
): Effect.Effect<Array<V | undefined>, never> =>
  Effect.sync(() => keys.map((k) => cache.get(k)));

const runBatchPut = <K, V>(
  cache: LRUCache<K, V>,
  entries: Array<[K, V]>
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    for (const [k, v] of entries) cache.put(k, v);
  });

// ─── Exported batch helpers ───────────────────────────────────────────────────

export function batchGet<K, V>(
  cache: LRUCache<K, V>,
  keys: K[]
): Array<V | undefined> {
  return Effect.runSync(runBatchGet(cache, keys));
}

export function batchPut<K, V>(
  cache: LRUCache<K, V>,
  entries: Array<[K, V]>
): void {
  Effect.runSync(runBatchPut(cache, entries));
}