class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.capacity = capacity;
    this.cache = new Map();
    
    // Sentinel nodes for doubly-linked list
    this.head = { key: null as any, value: null as any, prev: null, next: null };
    this.tail = { key: null as any, value: null as any, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }
    // Move to most recently used (front)
    this.removeNode(node);
    this.addToFront(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing node
      const node = this.cache.get(key)!;
      node.value = value;
      this.removeNode(node);
      this.addToFront(node);
    } else {
      // Create new node
      const node: Node<K, V> = { key, value, prev: null, next: null };
      this.cache.set(key, node);
      this.addToFront(node);
      
      // Evict least recently used if capacity exceeded
      if (this.cache.size > this.capacity) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }
    }
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private addToFront(node: Node<K, V>): void {
    const firstNode = this.head.next!;
    this.head.next = node;
    node.prev = this.head;
    node.next = firstNode;
    firstNode.prev = node;
  }
}

interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export { LRUCache };