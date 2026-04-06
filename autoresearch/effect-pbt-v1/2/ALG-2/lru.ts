interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export class LRUCache<K = string, V = any> {
  private capacity: number;
  private cache: Map<K, Node<K, V>> = new Map();
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be positive");
    }
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }

    // Move to front (most recently used)
    this.removeNode(node);
    this.addToFront(node);

    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.cache.get(key);

    if (node) {
      // Update existing node
      node.value = value;
      this.removeNode(node);
      this.addToFront(node);
    } else {
      // Create new node
      const newNode: Node<K, V> = {
        key,
        value,
        prev: null,
        next: null,
      };

      this.cache.set(key, newNode);
      this.addToFront(newNode);

      // Evict least recently used if capacity exceeded
      if (this.cache.size > this.capacity) {
        const lruNode = this.tail;
        if (lruNode) {
          this.removeNode(lruNode);
          this.cache.delete(lruNode.key);
        }
      }
    }
  }

  size(): number {
    return this.cache.size;
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

  private addToFront(node: Node<K, V>): void {
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
}