class Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();

    // Dummy sentinel nodes
    this.head = new Node<K, V>(null as any, null as any);
    this.tail = new Node<K, V>(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const node = this.cache.get(key)!;
    this.moveToTail(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key and move to tail
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToTail(node);
    } else {
      // Add new key
      if (this.cache.size >= this.capacity) {
        // Evict least recently used (first node after head)
        const lru = this.head.next!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }

      const node = new Node(key, value);
      this.cache.set(key, node);
      this.addToTail(node);
    }
  }

  private moveToTail(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToTail(node);
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private addToTail(node: Node<K, V>): void {
    const prev = this.tail.prev!;
    prev.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
  }
}