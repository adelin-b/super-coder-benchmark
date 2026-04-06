interface Node<K, V> {
  key: K;
  value: V;
  prev?: Node<K, V>;
  next?: Node<K, V>;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V> | undefined;
  private tail: Node<K, V> | undefined;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("Capacity must be at least 1");
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
    const existingNode = this.cache.get(key);

    if (existingNode) {
      existingNode.value = value;
      this.moveToEnd(existingNode);
    } else {
      const newNode: Node<K, V> = { key, value };
      this.cache.set(key, newNode);

      if (this.tail) {
        newNode.prev = this.tail;
        this.tail.next = newNode;
        this.tail = newNode;
      } else {
        this.head = newNode;
        this.tail = newNode;
      }

      if (this.cache.size > this.capacity) {
        if (this.head) {
          this.cache.delete(this.head.key);
          if (this.head.next) {
            this.head.next.prev = undefined;
            this.head = this.head.next;
          } else {
            this.head = undefined;
            this.tail = undefined;
          }
        }
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  private moveToEnd(node: Node<K, V>): void {
    if (node === this.tail) {
      return;
    }

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    if (this.tail) {
      this.tail.next = node;
      node.prev = this.tail;
      node.next = undefined;
      this.tail = node;
    }
  }
}