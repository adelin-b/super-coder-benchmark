import { Effect, Data } from "effect";

// ─── Internal doubly-linked list node ───────────────────────────────────────

interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

function makeNode<K, V>(key: K, value: V): Node<K, V> {
  return { key, value, prev: null, next: null };
}

// ─── Internal Effect-based logic ─────────────────────────────────────────────

class CapacityError extends Data.TaggedError("CapacityError")<{
  reason: string;
}> {}

// ─── Public error class ───────────────────────────────────────────────────────

export class LRUCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LRUCacheError";
    Object.setPrototypeOf(this, LRUCacheError.prototype);
  }
}

// ─── LRUCache class ───────────────────────────────────────────────────────────

export class LRUCache<K = string, V = unknown> {
  private capacity: number;
  private map: Map<K, Node<K, V>>;
  // Sentinel head (MRU end) and tail (LRU end)
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        if (capacity <= 0)
          yield* Effect.fail(
            new CapacityError({ reason: "Capacity must be greater than 0" })
          );
        return capacity;
      })
    );

    if (exit._tag === "Failure") {
      const raw = exit.cause;
      const msg =
        raw._tag === "Fail" && raw.error instanceof Error
          ? raw.error.message
          : (raw as any)?.error?.reason ?? "Invalid capacity";
      throw new LRUCacheError(msg);
    }

    this.capacity = exit.value;
    this.map = new Map();
    // Sentinels simplify edge cases
    this.head = makeNode<K, V>(null as unknown as K, null as unknown as V);
    this.tail = makeNode<K, V>(null as unknown as K, null as unknown as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // O(1) get — returns undefined on miss
  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (node === undefined) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  // O(1) put
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

  // Number of entries currently in the cache
  size(): number {
    return this.map.size;
  }

  // Remove all entries
  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // Check whether a key exists (without updating recency)
  has(key: K): boolean {
    return this.map.has(key);
  }

  // Delete a specific key; returns true if it existed
  delete(key: K): boolean {
    const node = this.map.get(key);
    if (node === undefined) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private removeNode(node: Node<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  private insertAtFront(node: Node<K, V>): void {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private moveToFront(node: Node<K, V>): void {
    this.removeNode(node);
    this.insertAtFront(node);
  }
}

// ─── Factory helper (alternative construction style) ─────────────────────────

export function createLRUCache<K = string, V = unknown>(
  capacity: number
): LRUCache<K, V> {
  return new LRUCache<K, V>(capacity);
}