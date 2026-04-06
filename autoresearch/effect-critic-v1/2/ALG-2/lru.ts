interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be positive");
    }
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Move to front (most recently used)
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.cache.get(key);

    if (node) {
      // Update value and move to front
      node.value = value;
      this.moveToHead(node);
    } else {
      // Create new node
      const newNode: Node<K, V> = { key, value, prev: null, next: null };
      this.cache.set(key, newNode);
      this.addToHead(newNode);

      // Evict if over capacity
      if (this.cache.size > this.capacity) {
        this.removeTail();
      }
    }
  }

  private moveToHead(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: Node<K, V>): void {
    node.prev = null;
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

  private removeTail(): void {
    if (this.tail) {
      this.cache.delete(this.tail.key);
      this.removeNode(this.tail);
    }
  }
}