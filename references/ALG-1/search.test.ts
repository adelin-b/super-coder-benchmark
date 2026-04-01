import { describe, it, expect } from 'vitest';
import { binarySearch } from './search.js';

describe('ALG-1: Binary Search Reference', () => {
  it('finds element in sorted array', () => {
    expect(binarySearch([1, 3, 5, 7, 9], 5)).toBe(2);
  });

  it('returns -1 for missing element', () => {
    expect(binarySearch([1, 3, 5, 7, 9], 4)).toBe(-1);
  });

  it('handles empty array', () => {
    expect(binarySearch([], 5)).toBe(-1);
  });

  it('handles single element — found', () => {
    expect(binarySearch([5], 5)).toBe(0);
  });

  it('handles single element — not found', () => {
    expect(binarySearch([5], 3)).toBe(-1);
  });

  it('finds first element', () => {
    expect(binarySearch([1, 2, 3, 4, 5], 1)).toBe(0);
  });

  it('finds last element', () => {
    expect(binarySearch([1, 2, 3, 4, 5], 5)).toBe(4);
  });

  it('returns FIRST occurrence of duplicates', () => {
    expect(binarySearch([1, 2, 2, 2, 3], 2)).toBe(1);
    expect(binarySearch([1, 1, 1, 1, 1], 1)).toBe(0);
    expect(binarySearch([1, 2, 3, 3, 3, 3, 4], 3)).toBe(2);
  });

  it('handles two elements', () => {
    expect(binarySearch([1, 2], 1)).toBe(0);
    expect(binarySearch([1, 2], 2)).toBe(1);
    expect(binarySearch([1, 2], 3)).toBe(-1);
  });

  it('handles target smaller than all', () => {
    expect(binarySearch([10, 20, 30], 5)).toBe(-1);
  });

  it('handles target larger than all', () => {
    expect(binarySearch([10, 20, 30], 35)).toBe(-1);
  });

  it('handles large array', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => i * 2);
    expect(binarySearch(arr, 5000)).toBe(2500);
    expect(binarySearch(arr, 5001)).toBe(-1);
  });

  // Invariant tests
  it('INV1: if result >= 0, arr[result] === target', () => {
    const arr = [1, 3, 5, 7, 9, 11, 13];
    for (const t of [1, 3, 5, 7, 9, 11, 13]) {
      const idx = binarySearch(arr, t);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(arr[idx]).toBe(t);
    }
  });

  it('INV2: if result === -1, target not in array', () => {
    const arr = [1, 3, 5, 7, 9];
    for (const t of [0, 2, 4, 6, 8, 10]) {
      expect(binarySearch(arr, t)).toBe(-1);
    }
  });

  it('INV3: returned index is first occurrence', () => {
    const arr = [1, 2, 2, 2, 2, 3, 3, 4];
    const idx2 = binarySearch(arr, 2);
    expect(idx2).toBe(1);
    expect(arr[idx2 - 1]).not.toBe(2); // element before is not 2

    const idx3 = binarySearch(arr, 3);
    expect(idx3).toBe(5);
    expect(arr[idx3 - 1]).not.toBe(3);
  });

  it('INV4: result in [-1, arr.length - 1]', () => {
    const arr = [1, 2, 3, 4, 5];
    for (const t of [0, 1, 3, 5, 6]) {
      const idx = binarySearch(arr, t);
      expect(idx).toBeGreaterThanOrEqual(-1);
      expect(idx).toBeLessThan(arr.length);
    }
  });
});
