class LRUCache {
  private capacity: number;
  private cache: Map<any, Node>;
  private head: Node | null;
  private tail: Node | null;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('Capacity must be at least 1');
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: any): any {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const node = this.cache.get(key)!;
    this.moveToTail(node);
    return node.value;
  }

  put(key: any, value: any): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToTail(node);
    } else {
      const node = new Node(key, value);
      this.cache.set(key, node);
      this.addToTail(node);

      if (this.cache.size > this.capacity) {
        const lru = this.head!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  private moveToTail(node: Node): void {
    this.removeNode(node);
    this.addToTail(node);
  }

  private removeNode(node: Node): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private addToTail(node: Node): void {
    if (!this.head) {
      this.head = node;
      this.tail = node;
      node.prev = null;
      node.next = null;
    } else {
      this.tail!.next = node;
      node.prev = this.tail;
      node.next = null;
      this.tail = node;
    }
  }
}

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

export { LRUCache };