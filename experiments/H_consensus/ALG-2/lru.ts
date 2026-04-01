export class LRUCache<V> {
  private capacity: number;
  private cache = new Map<string, V>();

  constructor(capacity: number) {
    if (capacity < 1) throw new Error('Capacity must be >= 1');
    this.capacity = capacity;
  }

  get(key: string): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val); // move to end (most recent)
    return val;
  }

  put(key: string, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
  }

  size(): number { return this.cache.size; }
}
