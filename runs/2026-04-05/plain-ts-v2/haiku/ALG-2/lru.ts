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
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
    this.cache = new Map();
    
    // Dummy sentinel nodes to simplify edge cases
    this.head = new Node<K, V>(null as unknown as K, null as unknown as V);
    this.tail = new Node<K, V>(null as unknown as K, null as unknown as V);
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
      // Update existing key
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToHead(node);
    } else {
      // Add new key
      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      
      // Evict least recently used if capacity exceeded
      if (this.cache.size > this.capacity) {
        const lruNode = this.tail.prev!;
        this.removeNode(lruNode);
        this.cache.delete(lruNode.key);
      }
    }
  }

  private moveToHead(node: Node<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeNode(node: Node<K, V>): void {
    const prevNode = node.prev!;
    const nextNode = node.next!;
    prevNode.next = nextNode;
    nextNode.prev = prevNode;
  }

  private addToHead(node: Node<K, V>): void {
    const oldFirst = this.head.next!;
    this.head.next = node;
    node.prev = this.head;
    node.next = oldFirst;
    oldFirst.prev = node;
  }

  size(): number {
    return this.cache.size;
  }
}