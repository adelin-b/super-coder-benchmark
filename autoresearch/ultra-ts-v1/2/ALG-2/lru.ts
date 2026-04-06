class Node {
  constructor(
    public key: any,
    public value: any,
    public prev: Node | null = null,
    public next: Node | null = null
  ) {}
}

export class LRUCache {
  private capacity: number;
  private cache: Map<any, Node>;
  private head: Node;
  private tail: Node;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error("Capacity must be positive");
    this.capacity = capacity;
    this.cache = new Map();
    this.head = new Node(null, null);
    this.tail = new Node(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: any): any {
    if (!this.cache.has(key)) return undefined;
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
        const lru = this.head.next!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
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

  private addToEnd(node: Node): void {
    node.prev = this.tail.prev;
    node.next = this.tail;
    this.tail.prev!.next = node;
    this.tail.prev = node;
  }

  private removeNode(node: Node): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }
}