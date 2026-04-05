/** BUG: Evicts most recently used instead of least recently used */
export class LRUCache<V> {
  private capacity: number;
  private cache = new Map<string, V>();
  constructor(capacity: number) { if (capacity < 1) throw new Error('Capacity must be >= 1'); this.capacity = capacity; }
  get(key: string): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  put(key: string, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      // BUG: evicts last (newest) instead of first (oldest)
      const keys = [...this.cache.keys()];
      this.cache.delete(keys[keys.length - 1]);
    }
  }
  size(): number { return this.cache.size; }
}
