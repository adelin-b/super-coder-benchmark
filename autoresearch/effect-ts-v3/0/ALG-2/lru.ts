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

    // Dummy nodes for easier boundary handling
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
      if (this.cache.size === this.capacity) {
        this.removeNode(this.head.next!);
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
    const prevNode = node.prev!;
    const nextNode = node.next!;
    prevNode.next = nextNode;
    nextNode.prev = prevNode;
    this.cache.delete(node.key);
  }

  private addToEnd(node: Node): void {
    const prevNode = this.tail.prev!;
    prevNode.next = node;
    node.prev = prevNode;
    node.next = this.tail;
    this.tail.prev = node;
  }
}