export class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, Node<K, V>>;
  private head: Node<K, V>;
  private tail: Node<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("capacity must be at least 1");
    }
    this.capacity = capacity;
    this.map = new Map();
    // sentinel nodes for O(1) removal at both ends
    this.head = new Node(undefined as any, undefined as any);
    this.tail = new Node(undefined as any, undefined as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }
    // move to head (most recently used)
    this.removeNode(node);
    this.addToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    if (this.map.has(key)) {
      // update existing and mark as recently used
      const node = this.map.get(key)!;
      node.value = value;
      this.removeNode(node);
      this.addToHead(node);
    } else {
      // add new node
      const node = new Node(key, value);
      this.map.set(key, node);
      this.addToHead(node);

      // evict least recently used if over capacity
      if (this.map.size > this.capacity) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
    }
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