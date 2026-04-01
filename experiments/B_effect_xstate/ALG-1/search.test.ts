import { describe, it, expect } from 'vitest';
import { binarySearch } from './search.js';

describe('ALG-1: Binary Search (Method A — Plain TS)', () => {
  it('finds element', () => expect(binarySearch([1,3,5,7,9], 5)).toBe(2));
  it('returns -1 for missing', () => expect(binarySearch([1,3,5,7,9], 4)).toBe(-1));
  it('empty array', () => expect(binarySearch([], 5)).toBe(-1));
  it('single found', () => expect(binarySearch([5], 5)).toBe(0));
  it('single not found', () => expect(binarySearch([5], 3)).toBe(-1));
  it('first element', () => expect(binarySearch([1,2,3], 1)).toBe(0));
  it('last element', () => expect(binarySearch([1,2,3], 3)).toBe(2));
  it('first occurrence of duplicates', () => {
    expect(binarySearch([1,2,2,2,3], 2)).toBe(1);
    expect(binarySearch([1,1,1,1], 1)).toBe(0);
    expect(binarySearch([1,2,3,3,3,4], 3)).toBe(2);
  });
  it('two elements', () => {
    expect(binarySearch([1,2], 1)).toBe(0);
    expect(binarySearch([1,2], 2)).toBe(1);
    expect(binarySearch([1,2], 3)).toBe(-1);
  });
  it('target out of range', () => {
    expect(binarySearch([10,20,30], 5)).toBe(-1);
    expect(binarySearch([10,20,30], 35)).toBe(-1);
  });
  it('large array', () => {
    const arr = Array.from({length:10000}, (_,i) => i*2);
    expect(binarySearch(arr, 5000)).toBe(2500);
    expect(binarySearch(arr, 5001)).toBe(-1);
  });
  it('INV1: found → arr[result] === target', () => {
    const arr = [1,3,5,7,9];
    for (const t of arr) { const i = binarySearch(arr, t); expect(arr[i]).toBe(t); }
  });
  it('INV2: -1 → target not in array', () => {
    const arr = [1,3,5,7,9];
    for (const t of [0,2,4,6,8,10]) expect(binarySearch(arr, t)).toBe(-1);
  });
  it('INV3: first occurrence', () => {
    const arr = [1,2,2,2,2,3,3,4];
    expect(binarySearch(arr, 2)).toBe(1);
    expect(binarySearch(arr, 3)).toBe(5);
  });
});
