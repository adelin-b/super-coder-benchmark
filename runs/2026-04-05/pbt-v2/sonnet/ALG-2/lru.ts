export class LRUCache<K = unknown, V = unknown> {
  private capacity: number;
  private map: Map<K, V>;

  constructor(capacity: number) {
    if (capacity <= 0) throw new RangeError("Capacity must be positive");
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key: K): V | -1 {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const lruKey = this.map.keys().next().value as K;
      this.map.delete(lruKey);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }
}