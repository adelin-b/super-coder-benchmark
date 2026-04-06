export class LRUCache {
  private capacity: number;
  private cache: Map<number, number>;
  private order: Map<number, { prev: number | null; next: number | null }>;
  private head: number | null = null;
  private tail: number | null = null;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("Capacity must be at least 1");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.order = new Map();
  }

  get(key: number): number {
    if (!this.cache.has(key)) {
      return -1;
    }
    this.moveToFront(key);
    return this.cache.get(key)!;
  }

  put(key: number, value: number): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.moveToFront(key);
    } else {
      if (this.cache.size === this.capacity) {
        this.evictLeast();
      }
      this.cache.set(key, value);
      this.addToFront(key);
    }
  }

  private addToFront(key: number): void {
    const node = { prev: null, next: this.head };
    if (this.head !== null) {
      this.order.get(this.head)!.prev = key;
    }
    this.order.set(key, node);
    this.head = key;
    if (this.tail === null) {
      this.tail = key;
    }
  }

  private moveToFront(key: number): void {
    const node = this.order.get(key)!;
    if (node.prev !== null) {
      this.order.get(node.prev)!.next = node.next;
    } else {
      return;
    }
    if (node.next !== null) {
      this.order.get(node.next)!.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = this.head;
    if (this.head !== null) {
      this.order.get(this.head)!.prev = key;
    }
    this.head = key;
  }

  private evictLeast(): void {
    if (this.tail === null) return;
    const key = this.tail;
    const node = this.order.get(key)!;
    if (node.prev !== null) {
      this.order.get(node.prev)!.next = null;
      this.tail = node.prev;
    } else {
      this.head = null;
      this.tail = null;
    }
    this.cache.delete(key);
    this.order.delete(key);
  }
}