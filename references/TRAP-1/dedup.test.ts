import { describe, it, expect } from 'vitest';
import { removeDuplicates, Item } from './dedup.js';

describe('TRAP-1: Remove Duplicates (Misleading Name Pattern)', () => {
  // --- Basic: naive dedup would pass these ---
  it('returns empty array for empty input', () => {
    expect(removeDuplicates([])).toEqual([]);
  });

  it('returns single item unchanged', () => {
    const items: Item[] = [{ id: 'a', value: 10, timestamp: 100 }];
    expect(removeDuplicates(items)).toEqual([{ id: 'a', value: 10, timestamp: 100 }]);
  });

  it('returns all items when no duplicates, sorted by id', () => {
    const items: Item[] = [
      { id: 'c', value: 1, timestamp: 1 },
      { id: 'a', value: 2, timestamp: 2 },
      { id: 'b', value: 3, timestamp: 3 },
    ];
    const result = removeDuplicates(items);
    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  // --- TRAP: Naive dedup (keep first/last) FAILS these ---

  it('keeps item with highest timestamp among duplicates', () => {
    const items: Item[] = [
      { id: 'x', value: 5, timestamp: 100 },
      { id: 'x', value: 5, timestamp: 200 }, // higher timestamp -> keep this
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 5, timestamp: 200 }]);
  });

  it('keeps item with highest timestamp even when it appears first', () => {
    const items: Item[] = [
      { id: 'x', value: 5, timestamp: 300 }, // highest timestamp -> keep this
      { id: 'x', value: 5, timestamp: 100 },
      { id: 'x', value: 5, timestamp: 200 },
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 5, timestamp: 300 }]);
  });

  it('breaks timestamp tie by lowest value', () => {
    const items: Item[] = [
      { id: 'x', value: 50, timestamp: 100 },
      { id: 'x', value: 10, timestamp: 100 }, // same timestamp, lower value -> keep this
      { id: 'x', value: 30, timestamp: 100 },
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 10, timestamp: 100 }]);
  });

  it('timestamp takes priority over value', () => {
    // Naive "keep lowest value" would pick the wrong one
    const items: Item[] = [
      { id: 'x', value: 1, timestamp: 50 },   // lowest value but old timestamp
      { id: 'x', value: 999, timestamp: 200 }, // highest timestamp wins
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 999, timestamp: 200 }]);
  });

  it('handles multiple groups with different resolution strategies', () => {
    const items: Item[] = [
      { id: 'b', value: 10, timestamp: 100 },
      { id: 'a', value: 20, timestamp: 200 },
      { id: 'b', value: 5, timestamp: 200 },   // b: higher timestamp -> keep
      { id: 'a', value: 10, timestamp: 200 },   // a: same timestamp, lower value -> keep
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([
      { id: 'a', value: 10, timestamp: 200 },
      { id: 'b', value: 5, timestamp: 200 },
    ]);
  });

  it('naive keep-first gives wrong answer for 3 duplicates', () => {
    // Keep-first would keep {value: 10, timestamp: 50}
    // Keep-last would keep {value: 30, timestamp: 200}
    // Correct: {value: 5, timestamp: 200} (highest timestamp, then lowest value)
    const items: Item[] = [
      { id: 'x', value: 10, timestamp: 50 },
      { id: 'x', value: 5, timestamp: 200 },  // correct answer
      { id: 'x', value: 30, timestamp: 200 },
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 5, timestamp: 200 }]);
  });

  it('naive keep-last gives wrong answer', () => {
    // Keep-last would keep the last item
    // But first item has highest timestamp
    const items: Item[] = [
      { id: 'x', value: 5, timestamp: 999 },  // correct: highest timestamp
      { id: 'x', value: 1, timestamp: 100 },   // keep-last would pick this
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 5, timestamp: 999 }]);
  });

  it('output is sorted by id even when input is reverse-sorted', () => {
    const items: Item[] = [
      { id: 'z', value: 1, timestamp: 1 },
      { id: 'y', value: 2, timestamp: 2 },
      { id: 'x', value: 3, timestamp: 3 },
    ];
    const result = removeDuplicates(items);
    expect(result.map(r => r.id)).toEqual(['x', 'y', 'z']);
  });

  it('handles equal timestamp and equal value — keeps first occurrence', () => {
    // Both have same id, timestamp, value — keep first
    const items: Item[] = [
      { id: 'x', value: 10, timestamp: 100 },
      { id: 'x', value: 10, timestamp: 100 },
    ];
    const result = removeDuplicates(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'x', value: 10, timestamp: 100 });
  });

  it('complex scenario: 5 items with same id', () => {
    const items: Item[] = [
      { id: 'a', value: 50, timestamp: 100 },
      { id: 'a', value: 30, timestamp: 300 },  // ts=300, val=30
      { id: 'a', value: 20, timestamp: 300 },  // ts=300, val=20 -> winner (highest ts, lowest val)
      { id: 'a', value: 10, timestamp: 200 },
      { id: 'a', value: 40, timestamp: 300 },
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'a', value: 20, timestamp: 300 }]);
  });

  it('mixed groups: some with duplicates, some without', () => {
    const items: Item[] = [
      { id: 'c', value: 1, timestamp: 1 },
      { id: 'a', value: 5, timestamp: 10 },
      { id: 'b', value: 3, timestamp: 20 },
      { id: 'a', value: 2, timestamp: 20 }, // a: ts=20 > ts=10, keep this
      { id: 'c', value: 0, timestamp: 1 },  // c: ts=1 = ts=1, val=0 < val=1, keep this
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([
      { id: 'a', value: 2, timestamp: 20 },
      { id: 'b', value: 3, timestamp: 20 },
      { id: 'c', value: 0, timestamp: 1 },
    ]);
  });

  it('does not mutate original array', () => {
    const items: Item[] = [
      { id: 'b', value: 1, timestamp: 1 },
      { id: 'a', value: 2, timestamp: 2 },
    ];
    const original = JSON.parse(JSON.stringify(items));
    removeDuplicates(items);
    expect(items).toEqual(original);
  });

  it('many duplicates across many ids', () => {
    const items: Item[] = [];
    // 10 ids, each with 5 entries
    for (let id = 0; id < 10; id++) {
      for (let j = 0; j < 5; j++) {
        items.push({ id: `id${id}`, value: j * 10, timestamp: j * 100 });
      }
    }
    const result = removeDuplicates(items);
    expect(result).toHaveLength(10);
    // Each should keep highest timestamp (j=4, ts=400)
    for (const r of result) {
      expect(r.timestamp).toBe(400);
      expect(r.value).toBe(40);
    }
    // Should be sorted by id
    expect(result.map(r => r.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `id${i}`)
    );
  });

  // --- Validation ---

  it('throws on empty id', () => {
    expect(() => removeDuplicates([{ id: '', value: 1, timestamp: 1 }]))
      .toThrow('Invalid item: empty id');
  });

  it('throws on NaN value', () => {
    expect(() => removeDuplicates([{ id: 'a', value: NaN, timestamp: 1 }]))
      .toThrow('Invalid item: non-finite number');
  });

  it('throws on Infinity timestamp', () => {
    expect(() => removeDuplicates([{ id: 'a', value: 1, timestamp: Infinity }]))
      .toThrow('Invalid item: non-finite number');
  });

  it('throws on -Infinity value', () => {
    expect(() => removeDuplicates([{ id: 'a', value: -Infinity, timestamp: 1 }]))
      .toThrow('Invalid item: non-finite number');
  });

  // --- Negative values ---

  it('handles negative timestamps correctly', () => {
    const items: Item[] = [
      { id: 'x', value: 5, timestamp: -100 },
      { id: 'x', value: 5, timestamp: -50 }, // -50 > -100, keep this
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: 5, timestamp: -50 }]);
  });

  it('handles negative values in tie-breaking', () => {
    const items: Item[] = [
      { id: 'x', value: -10, timestamp: 100 }, // lowest value -> keep
      { id: 'x', value: -5, timestamp: 100 },
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([{ id: 'x', value: -10, timestamp: 100 }]);
  });

  it('comprehensive trap: naive Set-based dedup always fails', () => {
    // A naive approach using Set or JSON.stringify to dedup would
    // consider these as non-duplicates (different values/timestamps)
    // but they share the same id so should be deduped
    const items: Item[] = [
      { id: 'item1', value: 100, timestamp: 1 },
      { id: 'item1', value: 200, timestamp: 2 },  // different value AND timestamp
      { id: 'item2', value: 50, timestamp: 3 },
      { id: 'item2', value: 25, timestamp: 3 },   // same timestamp, lower value -> keep
    ];
    const result = removeDuplicates(items);
    expect(result).toEqual([
      { id: 'item1', value: 200, timestamp: 2 },
      { id: 'item2', value: 25, timestamp: 3 },
    ]);
  });
});
