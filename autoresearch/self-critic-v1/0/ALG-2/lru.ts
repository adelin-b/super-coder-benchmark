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
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }
    this.moveToEnd(node);
    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.cache.get(key);

    if (node) {
      node.value = value;
      this.moveToEnd(node);
    } else {
      node = { key, value, prev: null, next: null };
      this.cache.set(key, node);
      this.addToEnd(node);

      if (this.cache.size > this.capacity) {
        this.removeLRU();
      }
    }
  }

  private moveToEnd(node: Node<K, V>): void {
    if (node === this.tail) return;
    this.removeNode(node);
    this.addToEnd(node);
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

  private addToEnd(node: Node<K, V>): void {
    node.prev = this.tail;
    node.next = null;

    if (this.tail) {
      this.tail.next = node;
    }

    this.tail = node;

    if (!this.head) {
      this.head = node;
    }
  }

  private removeLRU(): void {
    if (this.head) {
      this.cache.delete(this.head.key);
      this.removeNode(this.head);
    }
  }
}