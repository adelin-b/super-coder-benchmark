import { Effect } from "effect";

class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V> = new Map();
  private accessOrder: K[] = [];

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Mark as recently used by moving to end
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    return this.cache.get(key);
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key
      this.cache.set(key, value);
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    } else {
      // New key
      if (this.cache.size >= this.capacity) {
        // Evict least recently used (first in accessOrder)
        const lruKey = this.accessOrder.shift();
        if (lruKey !== undefined) {
          this.cache.delete(lruKey);
        }
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    if (!this.cache.has(key)) {
      return false;
    }
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

export { LRUCache };