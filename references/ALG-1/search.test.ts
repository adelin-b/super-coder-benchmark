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

  // --- Hard edge cases ---

  it('returns first occurrence when duplicates span the entire array', () => {
    // AI often gets midpoint-biased: the first occurrence is index 0 but
    // a naive binary search lands on the middle and returns it.
    expect(binarySearch([7, 7, 7, 7, 7, 7, 7], 7)).toBe(0);
  });

  it('returns first occurrence when duplicate block starts at index 0', () => {
    // Duplicates at the very start — left-bias must reach index 0.
    expect(binarySearch([3, 3, 3, 5, 6, 7], 3)).toBe(0);
  });

  it('returns first occurrence when duplicate block ends at last index', () => {
    // Duplicates at the very end — must still find the *first* of them.
    expect(binarySearch([1, 2, 4, 4, 4, 4], 4)).toBe(2);
  });

  it('handles adjacent pairs of duplicates correctly', () => {
    // Multiple duplicate groups; must return first of each group.
    const arr = [1, 1, 2, 2, 3, 3, 4, 4];
    expect(binarySearch(arr, 1)).toBe(0);
    expect(binarySearch(arr, 2)).toBe(2);
    expect(binarySearch(arr, 3)).toBe(4);
    expect(binarySearch(arr, 4)).toBe(6);
  });

  it('finds target that is exactly the midpoint value in even-length array', () => {
    // Even-length array where Math.floor midpoint calculation matters.
    const arr = [10, 20, 30, 40];
    expect(binarySearch(arr, 20)).toBe(1);
    expect(binarySearch(arr, 30)).toBe(2);
  });

  it('handles negative numbers and zero', () => {
    const arr = [-10, -5, -3, 0, 2, 7];
    expect(binarySearch(arr, -10)).toBe(0);
    expect(binarySearch(arr, 0)).toBe(3);
    expect(binarySearch(arr, -4)).toBe(-1);
    expect(binarySearch(arr, 7)).toBe(5);
  });

  it('handles three elements — target in each position and missing', () => {
    // Three-element arrays hit a different branch pattern than two-element.
    expect(binarySearch([1, 2, 3], 1)).toBe(0);
    expect(binarySearch([1, 2, 3], 2)).toBe(1);
    expect(binarySearch([1, 2, 3], 3)).toBe(2);
    expect(binarySearch([1, 2, 3], 0)).toBe(-1);
    expect(binarySearch([1, 2, 3], 4)).toBe(-1);
  });

  it('first occurrence with power-of-two-minus-one length array of duplicates', () => {
    // Length 15 (2^4 - 1) — a "perfect" binary tree shape.
    // Target appears starting at index 7, which is the exact midpoint.
    const arr = [1, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5];
    expect(binarySearch(arr, 5)).toBe(7);
    expect(binarySearch(arr, 1)).toBe(0);
  });
});
