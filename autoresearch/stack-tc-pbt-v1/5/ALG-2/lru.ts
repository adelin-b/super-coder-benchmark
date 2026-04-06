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
  private head: Node; // Dummy head (least recently used side)
  private tail: Node; // Dummy tail (most recently used side)

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
      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToTail(newNode);

      if (this.cache.size > this.capacity) {
        const lru = this.head.next!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }
    }
  }

  private addToTail(node: Node): void {
    node.prev = this.tail.prev;
    node.next = this.tail;
    this.tail.prev!.next = node;
    this.tail.prev = node;
  }

  private removeNode(node: Node): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToTail(node: Node): void {
    this.removeNode(node);
    this.addToTail(node);
  }
}