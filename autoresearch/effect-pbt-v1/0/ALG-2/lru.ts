interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export function createLRUCache<K, V>(
  capacity: number
): {
  get(key: K): V | undefined;
  put(key: K, value: V): void;
  size(): number;
} {
  if (capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  const map = new Map<K, Node<K, V>>();
  let head: Node<K, V> | null = null;
  let tail: Node<K, V> | null = null;

  const moveToTail = (node: Node<K, V>) => {
    if (node === tail) return;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    if (tail) {
      tail.next = node;
      node.prev = tail;
      node.next = null;
      tail = node;
    }
  };

  return {
    get(key: K): V | undefined {
      const node = map.get(key);
      if (!node) return undefined;
      moveToTail(node);
      return node.value;
    },

    put(key: K, value: V): void {
      const node = map.get(key);

      if (node) {
        node.value = value;
        moveToTail(node);
      } else {
        const newNode: Node<K, V> = {
          key,
          value,
          prev: null,
          next: null,
        };

        if (map.size >= capacity && head) {
          map.delete(head.key);
          head = head.next;
          if (head) {
            head.prev = null;
          } else {
            tail = null;
          }
        }

        if (tail) {
          tail.next = newNode;
          newNode.prev = tail;
          tail = newNode;
        } else {
          head = newNode;
          tail = newNode;
        }

        map.set(key, newNode);
      }
    },

    size(): number {
      return map.size;
    },
  };
}