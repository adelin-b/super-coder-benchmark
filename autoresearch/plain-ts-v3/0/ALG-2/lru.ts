class Node<K> {
  key: K;
  prev: Node<K> | null = null;
  next: Node<K> | null = null;

  constructor(key: K) {
    this.key = key;
  }
}

class LinkedList<K> {
  private head: Node<K> | null = null;
  private tail: Node<K> | null = null;

  addToFront(key: K): Node<K> {
    const node = new Node(key);
    if (this.head === null) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    return node;
  }

  moveToFront(node: Node<K>): void {
    if (node === this.head) return;

    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    if (node === this.tail) {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (this.tail === null) {
      this.tail = node;
    }
  }

  removeLast(): K {
    if (this.tail === null) {
      throw new Error('Cannot remove from empty list');
    }

    const key = this.tail.key;

    if (this.tail.prev) {
      this.tail.prev.next = null;
      this.tail = this.tail.prev;
    } else {
      this.head = this.tail = null;
    }

    return key;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private order: LinkedList<K>;
  private nodeMap: Map<K, Node<K>>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.order = new LinkedList();
    this.nodeMap = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const node = this.nodeMap.get(key)!;
    this.order.moveToFront(node);

    return this.cache.get(key);
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      const node = this.nodeMap.get(key)!;
      this.order.moveToFront(node);
    } else {
      if (this.cache.size >= this.capacity) {
        const lruKey = this.order.removeLast();
        this.cache.delete(lruKey);
        this.nodeMap.delete(lruKey);
      }

      this.cache.set(key, value);
      const node = this.order.addToFront(key);
      this.nodeMap.set(key, node);
    }
  }

  size(): number {
    return this.cache.size;
  }
}