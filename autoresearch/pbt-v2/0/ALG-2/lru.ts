interface Node<K, V> {
  key: K
  value: V
  prev: Node<K, V> | null
  next: Node<K, V> | null
}

export class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, Node<K, V>>
  private head: Node<K, V> | null
  private tail: Node<K, V> | null

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
    this.head = null
    this.tail = null
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    const node = this.cache.get(key)!
    this.moveToTail(node)
    return node.value
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!
      node.value = value
      this.moveToTail(node)
      return
    }

    const node: Node<K, V> = { key, value, prev: null, next: null }
    this.cache.set(key, node)
    this.addToTail(node)

    if (this.cache.size > this.capacity) {
      this.removeHead()
    }
  }

  private moveToTail(node: Node<K, V>): void {
    this.removeNode(node)
    this.addToTail(node)
  }

  private removeNode(node: Node<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }

    node.prev = null
    node.next = null
  }

  private addToTail(node: Node<K, V>): void {
    node.prev = this.tail
    node.next = null

    if (this.tail) {
      this.tail.next = node
    }
    this.tail = node

    if (!this.head) {
      this.head = node
    }
  }

  private removeHead(): void {
    if (!this.head) {
      return
    }
    this.cache.delete(this.head.key)
    this.removeNode(this.head)
  }
}