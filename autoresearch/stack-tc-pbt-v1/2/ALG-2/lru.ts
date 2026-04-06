class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("Capacity must be at least 1");
    }
    this.capacity = capacity;
    this.cache = new Map();

    // Sentinel nodes for O(1) insertion/deletion
    this.head = new Node<K, V>(undefined as unknown as K, undefined as unknown as V);
    this.tail = new Node<K, V>(undefined as unknown as K, undefined as unknown as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
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
    } else {
      if (this.cache.size === this.capacity) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }

      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToFront(newNode);
    }
  }

  private moveToFront(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: Node<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }
}

class Node<K, V> {
  prev: Node<K, V> | null = null;
  next: Node<K, V> | null = null;

  constructor(public key: K, public value: V) {}
}

export { LRUCache };