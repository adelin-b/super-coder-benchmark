class Node<T> {
  key: string;
  value: T;
  prev: Node<T> | null = null;
  next: Node<T> | null = null;

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<T> {
  private capacity: number;
  private map: Map<string, Node<T>>;
  private head: Node<T>;
  private tail: Node<T>;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("capacity must be at least 1");
    }
    this.capacity = capacity;
    this.map = new Map();
    this.head = new Node("", undefined as any);
    this.tail = new Node("", undefined as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.removeNode(node);
    this.addToTail(node);
    return node.value;
  }

  put(key: string, value: T): void {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.value = value;
      this.removeNode(node);
      this.addToTail(node);
    } else {
      if (this.map.size === this.capacity) {
        const lru = this.head.next!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
      const node = new Node(key, value);
      this.map.set(key, node);
      this.addToTail(node);
    }
  }

  size(): number {
    return this.map.size;
  }

  private removeNode(node: Node<T>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private addToTail(node: Node<T>): void {
    node.prev = this.tail.prev;
    node.next = this.tail;
    this.tail.prev!.next = node;
    this.tail.prev = node;
  }
}