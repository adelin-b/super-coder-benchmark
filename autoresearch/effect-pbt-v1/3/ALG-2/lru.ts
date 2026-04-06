import { Effect, Exit, Cause } from "effect";

interface Node<K, V> {
  key: K;
  value: V;
  prev?: Node<K, V>;
  next?: Node<K, V>;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head?: Node<K, V>;
  private tail?: Node<K, V>;

  constructor(capacity: number) {
    const exit = Effect.runSyncExit(
      Effect.gen(function* () {
        if (capacity <= 0) {
          yield* Effect.fail(new Error("Capacity must be positive"));
        }
        return capacity;
      })
    );
    if (Exit.isFailure(exit)) {
      throw Cause.squash(exit.cause);
    }
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const node = this.cache.get(key)!;
    this.moveToFront(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToFront(node);
      return;
    }

    if (this.cache.size >= this.capacity) {
      if (this.tail) {
        this.cache.delete(this.tail.key);
        this.removeNode(this.tail);
      }
    }

    const newNode: Node<K, V> = { key, value };
    this.cache.set(key, newNode);
    this.addToFront(newNode);
  }

  size(): number {
    return this.cache.size;
  }

  private addToFront(node: Node<K, V>): void {
    node.prev = undefined;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: Node<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToFront(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToFront(node);
  }
}