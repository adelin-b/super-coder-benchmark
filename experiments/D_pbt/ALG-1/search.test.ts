import { describe, it } from 'vitest';
import fc from 'fast-check';
import { binarySearch } from './search.js';

const arbSortedArray = fc.array(fc.integer({ min: -1000, max: 1000 }), { maxLength: 200 })
  .map(a => [...a].sort((x, y) => x - y));

describe('ALG-1: Binary Search (Method D — PBT)', () => {
  it('PROPERTY: if found, arr[result] === target', () => {
    fc.assert(fc.property(arbSortedArray, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
      const idx = binarySearch(arr, target);
      if (idx >= 0) return arr[idx] === target;
      return true;
    }), { numRuns: 2000 });
  });

  it('PROPERTY: if -1, target not in array', () => {
    fc.assert(fc.property(arbSortedArray, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
      const idx = binarySearch(arr, target);
      if (idx === -1) return !arr.includes(target);
      return true;
    }), { numRuns: 2000 });
  });

  it('PROPERTY: result is first occurrence', () => {
    fc.assert(fc.property(arbSortedArray, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
      const idx = binarySearch(arr, target);
      if (idx > 0) return arr[idx - 1] !== target;
      return true;
    }), { numRuns: 2000 });
  });

  it('PROPERTY: result in [-1, arr.length - 1]', () => {
    fc.assert(fc.property(arbSortedArray, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
      const idx = binarySearch(arr, target);
      return idx >= -1 && idx < Math.max(arr.length, 1);
    }), { numRuns: 2000 });
  });

  it('PROPERTY: agrees with indexOf for first occurrence', () => {
    fc.assert(fc.property(arbSortedArray, fc.integer({ min: -1000, max: 1000 }), (arr, target) => {
      const idx = binarySearch(arr, target);
      const expected = arr.indexOf(target);
      return idx === expected;
    }), { numRuns: 2000 });
  });

  it('PROPERTY: empty array always returns -1', () => {
    fc.assert(fc.property(fc.integer(), (target) => {
      return binarySearch([], target) === -1;
    }));
  });
});
