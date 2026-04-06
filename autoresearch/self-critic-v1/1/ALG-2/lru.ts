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
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be positive");
    }
    this.capacity = capacity;
    this.cache = new Map();

    // Sentinel nodes for doubly linked list
    this.head = new Node<K, V>(undefined as any, undefined as any);
    this.tail = new Node<K, V>(undefined as any, undefined as any);
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
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToTail(node);
    } else {
      if (this.cache.size >= this.capacity) {
        const lruNode = this.head.next!;
        this.removeNode(lruNode);
        this.cache.delete(lruNode.key);
      }

      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.insertBeforeTail(newNode);
    }
  }

  private moveToTail(node: Node<K, V>): void {
    this.removeNode(node);
    this.insertBeforeTail(node);
  }

  private insertBeforeTail(node: Node<K, V>): void {
    node.prev = this.tail.prev;
    node.next = this.tail;
    if (this.tail.prev) {
      this.tail.prev.next = node;
    }
    this.tail.prev = node;
  }

  private removeNode(node: Node<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }
}