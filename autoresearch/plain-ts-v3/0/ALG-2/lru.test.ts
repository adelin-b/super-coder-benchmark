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
});
