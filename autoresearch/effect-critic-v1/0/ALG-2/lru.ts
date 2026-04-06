interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.head = { key: undefined as any, value: undefined as any, prev: null, next: null };
    this.tail = { key: undefined as any, value: undefined as any, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private removeNode(node: Node<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private addToHead(node: Node<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const node = this.cache.get(key)!;
    this.removeNode(node);
    this.addToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.removeNode(node);
      this.addToHead(node);
    } else {
      if (this.cache.size >= this.capacity) {
        const lruNode = this.tail.prev!;
        this.removeNode(lruNode);
        this.cache.delete(lruNode.key);
      }
      const newNode: Node<K, V> = { key, value, prev: null, next: null };
      this.cache.set(key, newNode);
      this.addToHead(newNode);
    }
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      this.removeNode(node);
      this.cache.delete(key);
      return true;
    }
    return false;
  }
}