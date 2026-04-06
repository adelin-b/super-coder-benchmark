type Node<K, V> = {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
};

export class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, Node<K, V>>;
  private head: Node<K, V> | null;
  private tail: Node<K, V> | null;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error("Capacity must be at least 1");
    }
    this.capacity = capacity;
    this.map = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    let node = this.map.get(key);
    if (node) {
      node.value = value;
      this.moveToHead(node);
    } else {
      const newNode: Node<K, V> = {
        key,
        value,
        prev: null,
        next: null,
      };
      this.map.set(key, newNode);
      this.addToHead(newNode);

      if (this.map.size > this.capacity) {
        if (this.tail) {
          this.map.delete(this.tail.key);
          this.removeNode(this.tail);
        }
      }
    }
  }

  size(): number {
    return this.map.size;
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.map.delete(key);
    this.removeNode(node);
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private moveToHead(node: Node<K, V>): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeNode(node: Node<K, V>): void {
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

  private addToHead(node: Node<K, V>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }
}