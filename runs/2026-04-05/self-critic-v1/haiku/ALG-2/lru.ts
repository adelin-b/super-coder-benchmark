export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.cache = new Map();
    
    // Sentinel nodes for doubly-linked list
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
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToHead(node);
    } else {
      const newNode = new Node<K, V>(key, value);
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      
      if (this.cache.size > this.capacity) {
        const removedNode = this.tail.prev!;
        this.removeNode(removedNode);
        this.cache.delete(removedNode.key);
      }
    }
  }

  private moveToHead(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: Node<K, V>): void {
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
    node.prev = this.head;
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev;
    const next = node.next;
    prev!.next = next;
    next!.prev = prev;
  }
}

class Node<K, V> {
  key: K;
  value: V;
  prev?: Node<K, V>;
  next?: Node<K, V>;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}