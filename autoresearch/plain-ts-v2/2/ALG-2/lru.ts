interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V> | null;
  private tail: Node<K, V> | null;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("Capacity must be at least 1");
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  private moveToHead(node: Node<K, V>): void {
    if (node === this.head) return;

    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;

    // Move to head
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;

    if (!this.tail) this.tail = node;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const node = this.cache.get(key)!;
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToHead(node);
      return;
    }

    if (this.cache.size >= this.capacity && this.tail) {
      this.cache.delete(this.tail.key);
      if (this.tail.prev) {
        this.tail.prev.next = null;
        this.tail = this.tail.prev;
      } else {
        this.head = this.tail = null;
      }
    }

    const newNode: Node<K, V> = {
      key,
      value,
      prev: null,
      next: this.head
    };

    if (this.head) this.head.prev = newNode;
    this.head = newNode;
    if (!this.tail) this.tail = newNode;

    this.cache.set(key, newNode);
  }

  size(): number {
    return this.cache.size;
  }
}