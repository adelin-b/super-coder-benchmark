export class LRUCache<V> {
  private capacity: number;
  private map: Map<string, Node<V>>;
  private head: Node<V> | null;
  private tail: Node<V> | null;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('Capacity must be at least 1');
    }
    this.capacity = capacity;
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }
    // Move to end (most recently used)
    this.moveToEnd(node);
    return node.value;
  }

  put(key: string, value: V): void {
    let node = this.map.get(key);
    if (node) {
      // Update existing key
      node.value = value;
      this.moveToEnd(node);
    } else {
      // New key
      node = { key, value, prev: null, next: null };
      this.map.set(key, node);
      this.addToEnd(node);

      // Check if we exceed capacity
      if (this.map.size > this.capacity) {
        // Remove LRU (head)
        if (this.head) {
          this.map.delete(this.head.key);
          this.removeNode(this.head);
        }
      }
    }
  }

  size(): number {
    return this.map.size;
  }

  private addToEnd(node: Node<V>): void {
    if (!this.tail) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
  }

  private moveToEnd(node: Node<V>): void {
    if (node === this.tail) {
      return; // Already at end
    }
    this.removeNode(node);
    this.addToEnd(node);
  }

  private removeNode(node: Node<V>): void {
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
}

interface Node<V> {
  key: string;
  value: V;
  prev: Node<V> | null;
  next: Node<V> | null;
}