export class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, DoublyLinkedNode<K, V>>;
  private head: DoublyLinkedNode<K, V>;
  private tail: DoublyLinkedNode<K, V>;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.map = new Map();
    // Sentinel head and tail nodes
    this.head = new DoublyLinkedNode<K, V>(null as unknown as K, null as unknown as V);
    this.tail = new DoublyLinkedNode<K, V>(null as unknown as K, null as unknown as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | -1 {
    const node = this.map.get(key);
    if (node === undefined) return -1;
    this.moveToFront(node);
    return node.value;
  }

  put(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }
    const node = new DoublyLinkedNode(key, value);
    this.map.set(key, node);
    this.insertAtFront(node);
    if (this.map.size > this.capacity) {
      const lru = this.tail.prev!;
      this.removeNode(lru);
      this.map.delete(lru.key);
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private insertAtFront(node: DoublyLinkedNode<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next!;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: DoublyLinkedNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToFront(node: DoublyLinkedNode<K, V>): void {
    this.removeNode(node);
    this.insertAtFront(node);
  }
}

class DoublyLinkedNode<K, V> {
  key: K;
  value: V;
  prev: DoublyLinkedNode<K, V> | null = null;
  next: DoublyLinkedNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}