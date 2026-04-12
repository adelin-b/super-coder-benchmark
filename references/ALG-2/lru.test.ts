import { describe, it, expect } from 'vitest';
import { LRUCache } from './lru.js';

describe('ALG-2: LRU Cache', () => {
  it('get/put basic', () => {
    const c = new LRUCache<number>(2);
    c.put('a', 1); c.put('b', 2);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBe(2);
  });
  it('evicts LRU on overflow', () => {
    const c = new LRUCache<number>(2);
    c.put('a', 1); c.put('b', 2); c.put('c', 3);
    expect(c.get('a')).toBeUndefined(); // evicted
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
  it('get refreshes access order', () => {
    const c = new LRUCache<number>(2);
    c.put('a', 1); c.put('b', 2);
    c.get('a'); // refresh a
    c.put('c', 3); // should evict b, not a
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
  });
  it('update existing key', () => {
    const c = new LRUCache<number>(2);
    c.put('a', 1); c.put('a', 2);
    expect(c.get('a')).toBe(2);
    expect(c.size()).toBe(1);
  });
  it('capacity 1', () => {
    const c = new LRUCache<number>(1);
    c.put('a', 1); c.put('b', 2);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
  });
  it('miss returns undefined', () => {
    const c = new LRUCache<number>(5);
    expect(c.get('x')).toBeUndefined();
  });
  it('throws on capacity < 1', () => {
    expect(() => new LRUCache(0)).toThrow();
  });

  // --- Hard edge cases ---

  it('put on existing key refreshes access order (does not evict itself)', () => {
    // A common bug: put('a', newVal) doesn't move 'a' to most-recent,
    // so a subsequent put('c') evicts 'a' instead of 'b'.
    const c = new LRUCache<number>(2);
    c.put('a', 1);
    c.put('b', 2);
    c.put('a', 10); // update a — should refresh it to most recent
    c.put('c', 3);  // should evict b (the LRU), not a
    expect(c.get('a')).toBe(10);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });

  it('get on non-existent key does not affect eviction order', () => {
    // Accessing a missing key should be a no-op for ordering.
    const c = new LRUCache<number>(2);
    c.put('a', 1);
    c.put('b', 2);
    c.get('nonexistent'); // should not disturb order
    c.put('c', 3); // should evict a (oldest)
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });

  it('eviction cascade: inserting N+1 unique keys evicts the first', () => {
    // Capacity 3, insert 4 keys: only the first should be evicted.
    const c = new LRUCache<string>(3);
    c.put('a', 'A');
    c.put('b', 'B');
    c.put('c', 'C');
    c.put('d', 'D');
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe('B');
    expect(c.get('c')).toBe('C');
    expect(c.get('d')).toBe('D');
    expect(c.size()).toBe(3);
  });

  it('interleaved get and put: complex access pattern', () => {
    // Capacity 3, complex interleaving to test precise LRU tracking.
    const c = new LRUCache<number>(3);
    c.put('a', 1);  // order: a
    c.put('b', 2);  // order: a, b
    c.put('c', 3);  // order: a, b, c
    c.get('a');      // order: b, c, a  (a refreshed)
    c.put('d', 4);  // order: c, a, d  (b evicted)
    expect(c.get('b')).toBeUndefined();
    c.get('c');      // order: a, d, c  (c refreshed)
    c.put('e', 5);   // order: d, c, e  (a evicted)
    expect(c.get('a')).toBeUndefined();
    expect(c.get('d')).toBe(4);
    expect(c.get('c')).toBe(3);
    expect(c.get('e')).toBe(5);
  });

  it('update existing key does not change size even at capacity', () => {
    const c = new LRUCache<number>(2);
    c.put('a', 1);
    c.put('b', 2);
    c.put('a', 99);  // update, not insert — size should stay 2
    expect(c.size()).toBe(2);
    c.put('b', 88);  // update again
    expect(c.size()).toBe(2);
    expect(c.get('a')).toBe(99);
    expect(c.get('b')).toBe(88);
  });

  it('capacity 1: put replaces the only entry each time', () => {
    const c = new LRUCache<number>(1);
    c.put('a', 1);
    c.put('b', 2);
    c.put('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
    expect(c.size()).toBe(1);
  });

  it('get returns undefined for evicted key that was once present', () => {
    // Ensure evicted keys are truly deleted, not returning stale data.
    const c = new LRUCache<number>(2);
    c.put('x', 42);
    c.put('y', 43);
    c.put('z', 44); // evicts x
    const result = c.get('x');
    expect(result).toBeUndefined();
    // Re-insert x and verify it works fresh
    c.put('x', 100); // evicts y
    expect(c.get('x')).toBe(100);
    expect(c.get('y')).toBeUndefined();
  });

  it('throws on negative capacity', () => {
    expect(() => new LRUCache(-1)).toThrow();
  });
});
