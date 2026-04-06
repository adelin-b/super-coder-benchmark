export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    // Sentinel nodes for doubly-linked list
    this.head = new Node<K, V>(undefined, undefined);
    this.tail = new Node<K, V>(undefined, undefined);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const node = this.cache.get(key)!;
    this.moveToEnd(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToEnd(node);
    } else {
      if (this.cache.size >= this.capacity) {
        this.removeLRU();
      }
      const newNode = new Node<K, V>(key, value);
      this.cache.set(key, newNode);
      this.addToEnd(newNode);
    }
  }

  private moveToEnd(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToEnd(node);
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private addToEnd(node: Node<K, V>): void {
    node.prev = this.tail.prev;
    node.next = this.tail;
    this.tail.prev!.next = node;
    this.tail.prev = node;
  }

  private removeLRU(): void {
    const lruNode = this.head.next!;
    if (lruNode !== this.tail) {
      this.removeNode(lruNode);
      this.cache.delete(lruNode.key!);
    }
  }
}

class Node<K, V> {
  key?: K;
  value?: V;
  prev?: Node<K, V>;
  next?: Node<K, V>;

  constructor(key?: K, value?: V) {
    this.key = key;
    this.value = value;
  }
}