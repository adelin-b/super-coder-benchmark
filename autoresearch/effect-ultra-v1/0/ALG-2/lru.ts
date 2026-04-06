class Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null = null;
  next: Node<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error("Capacity must be positive");
    this.capacity = capacity;
    this.cache = new Map();
  }

  private moveToTail(node: Node<K, V>): void {
    if (this.tail === node) return;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.head === node) this.head = node.next;

    node.prev = this.tail;
    node.next = null;
    if (this.tail) this.tail.next = node;
    this.tail = node;
    if (!this.head) this.head = node;
  }

  private removeNode(node: Node<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.head === node) this.head = node.next;
    if (this.tail === node) this.tail = node.prev;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;
    this.moveToTail(node);
    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.cache.get(key);
    if (node) {
      node.value = value;
      this.moveToTail(node);
    } else {
      if (this.cache.size >= this.capacity) {
        if (this.head) {
          this.cache.delete(this.head.key);
          this.removeNode(this.head);
        }
      }
      node = new Node(key, value);
      this.cache.set(key, node);
      this.moveToTail(node);
    }
  }

  get size(): number {
    return this.cache.size;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    this.cache.delete(key);
    this.removeNode(node);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }
}