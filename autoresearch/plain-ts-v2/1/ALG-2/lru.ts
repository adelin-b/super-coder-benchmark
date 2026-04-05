class Node {
  key: number;
  value: number;
  prev: Node | null = null;
  next: Node | null = null;

  constructor(key: number, value: number) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache {
  private capacity: number;
  private cache: Map<number, Node>;
  private head: Node;
  private tail: Node;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = new Node(0, 0);
    this.tail = new Node(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    if (!this.cache.has(key)) {
      return -1;
    }
    const node = this.cache.get(key)!;
    this.moveToEnd(node);
    return node.value;
  }

  put(key: number, value: number): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToEnd(node);
    } else {
      if (this.cache.size >= this.capacity) {
        const lruNode = this.head.next!;
        this.removeNode(lruNode);
        this.cache.delete(lruNode.key);
      }
      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToEnd(newNode);
    }
  }

  private moveToEnd(node: Node): void {
    this.removeNode(node);
    this.addToEnd(node);
  }

  private removeNode(node: Node): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private addToEnd(node: Node): void {
    const prev = this.tail.prev!;
    prev.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
  }
}