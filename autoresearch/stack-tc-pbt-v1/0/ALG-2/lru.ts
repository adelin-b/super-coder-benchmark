class Node<K, V> {
  key: K
  value: V
  next: Node<K, V> | null = null
  prev: Node<K, V> | null = null

  constructor(key: K, value: V) {
    this.key = key
    this.value = value
  }
}

export class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, Node<K, V>>
  private head: Node<K, V>
  private tail: Node<K, V>

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
    // Sentinel nodes for easier manipulation
    this.head = new Node<K, V>(undefined as unknown as K, undefined as unknown as V)
    this.tail = new Node<K, V>(undefined as unknown as K, undefined as unknown as V)
    this.head.next = this.tail
    this.tail.prev = this.head
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }
    const node = this.cache.get(key)!
    this.moveToHead(node)
    return node.value
  }

  put(key: K, value: V): void {
    if (this.capacity <= 0) {
      return
    }

    if (this.cache.has(key)) {
      const node = this.cache.get(key)!
      node.value = value
      this.moveToHead(node)
      return
    }

    const newNode = new Node(key, value)
    this.cache.set(key, newNode)
    this.addToHead(newNode)

    if (this.cache.size > this.capacity) {
      const lruNode = this.tail.prev!
      this.removeNode(lruNode)
      this.cache.delete(lruNode.key)
    }
  }

  private moveToHead(node: Node<K, V>): void {
    this.removeNode(node)
    this.addToHead(node)
  }

  private removeNode(node: Node<K, V>): void {
    const prev = node.prev!
    const next = node.next!
    prev.next = next
    next.prev = prev
  }

  private addToHead(node: Node<K, V>): void {
    node.next = this.head.next
    node.prev = this.head
    this.head.next!.prev = node
    this.head.next = node
  }
}