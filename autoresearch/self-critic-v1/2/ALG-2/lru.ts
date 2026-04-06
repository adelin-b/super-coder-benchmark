class Node {
  key: any;
  value: any;
  prev: Node | null = null;
  next: Node | null = null;

  constructor(key: any, value: any) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache {
  private capacity: number;
  private cache: Map<any, Node>;
  private head: Node;
  private tail: Node;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("Capacity must be at least 1");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.head = new Node(null, null);
    this.tail = new Node(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: any): any {
    if (!this.cache.has(key)) {
      return null;
    }
    const node = this.cache.get(key)!;
    this.moveToEnd(node);
    return node.value;
  }

  put(key: any, value: any): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToEnd(node);
    } else {
      if (this.cache.size >= this.capacity) {
        const removed = this.head.next!;
        this.removeNode(removed);
        this.cache.delete(removed.key);
      }
      const node = new Node(key, value);
      this.cache.set(key, node);
      this.addToEnd(node);
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