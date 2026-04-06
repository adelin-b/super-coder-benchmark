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
    if (capacity < 1) throw new Error("Capacity must be at least 1");
    this.capacity = capacity;
    this.cache = new Map();
    
    this.head = { key: undefined as any, value: undefined as any, prev: null, next: null };
    this.tail = { key: undefined as any, value: undefined as any, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.cache.get(key);
    
    if (node) {
      node.value = value;
      this.moveToHead(node);
    } else {
      node = { key, value, prev: null, next: null };
      this.cache.set(key, node);
      this.addToHead(node);
      
      if (this.cache.size > this.capacity) {
        const removed = this.removeTail();
        if (removed) this.cache.delete(removed.key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  private moveToHead(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: Node<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private removeTail(): Node<K, V> | null {
    const node = this.tail.prev;
    if (node === this.head) return null;
    this.removeNode(node!);
    return node!;
  }
}