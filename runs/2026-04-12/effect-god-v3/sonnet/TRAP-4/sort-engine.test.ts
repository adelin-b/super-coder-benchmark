import { describe, it, expect } from 'vitest';
import { createSortEngine, Item } from './sort-engine.js';

describe('TRAP-4: Sort Engine (Inverted Expectations Pattern)', () => {
  // --- Basic sorting ---

  it('ascending sort of numbers', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'ascending' }] });
    const result = engine.sort([{ x: 3 }, { x: 1 }, { x: 2 }]);
    expect(result.map(r => r.x)).toEqual([1, 2, 3]);
  });

  it('descending sort of numbers', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'descending' }] });
    const result = engine.sort([{ x: 1 }, { x: 3 }, { x: 2 }]);
    expect(result.map(r => r.x)).toEqual([3, 2, 1]);
  });

  it('ascending sort of strings', () => {
    const engine = createSortEngine({ keys: [{ field: 'name', direction: 'ascending' }] });
    const result = engine.sort([{ name: 'charlie' }, { name: 'alice' }, { name: 'bob' }]);
    expect(result.map(r => r.name)).toEqual(['alice', 'bob', 'charlie']);
  });

  // --- THE TRAP: invertComparison ---

  it('ascending + invertComparison=true gives descending non-null order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', invertComparison: true }],
    });
    const result = engine.sort([{ x: 1 }, { x: 3 }, { x: 2 }]);
    // Inversion flips raw comparison, so ascending becomes effectively descending
    expect(result.map(r => r.x)).toEqual([3, 2, 1]);
  });

  it('descending + invertComparison=true gives ascending non-null order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', invertComparison: true }],
    });
    const result = engine.sort([{ x: 3 }, { x: 1 }, { x: 2 }]);
    // Double inversion: ascending
    expect(result.map(r => r.x)).toEqual([1, 2, 3]);
  });

  // --- THE CRITICAL TRAP: null handling is INDEPENDENT of inversion/direction ---

  it('nulls: first is ALWAYS first regardless of ascending + no inversion', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', nulls: 'first' }],
    });
    const result = engine.sort([{ x: 2 }, { x: null }, { x: 1 }]);
    expect(result.map(r => r.x)).toEqual([null, 1, 2]);
  });

  it('nulls: first is ALWAYS first even with descending', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', nulls: 'first' }],
    });
    const result = engine.sort([{ x: 2 }, { x: null }, { x: 1 }]);
    expect(result.map(r => r.x)).toEqual([null, 2, 1]);
  });

  it('nulls: first is ALWAYS first even with invertComparison=true', () => {
    // This is the KEY trap. Many implementations will flip null handling
    // when invertComparison is true.
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', invertComparison: true, nulls: 'first' }],
    });
    const result = engine.sort([{ x: 2 }, { x: null }, { x: 1 }]);
    // Nulls STILL first, non-null values in descending order (due to inversion)
    expect(result.map(r => r.x)).toEqual([null, 2, 1]);
  });

  it('nulls: first + descending + invertComparison: nulls still first', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', invertComparison: true, nulls: 'first' }],
    });
    const result = engine.sort([{ x: 2 }, { x: null }, { x: 1 }]);
    // Nulls first, non-null in ascending order (desc + invert = ascending)
    expect(result.map(r => r.x)).toEqual([null, 1, 2]);
  });

  it('nulls: last + ascending + invertComparison: nulls still last', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', invertComparison: true, nulls: 'last' }],
    });
    const result = engine.sort([{ x: null }, { x: 2 }, { x: 1 }]);
    // Non-null descending (due to inversion), nulls at end
    expect(result.map(r => r.x)).toEqual([2, 1, null]);
  });

  it('nulls: last + descending + invertComparison: nulls still last', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', invertComparison: true, nulls: 'last' }],
    });
    const result = engine.sort([{ x: null }, { x: 2 }, { x: 1 }]);
    // Non-null ascending (desc + invert), nulls at end
    expect(result.map(r => r.x)).toEqual([1, 2, null]);
  });

  it('undefined values treated same as null', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', nulls: 'first' }],
    });
    const result = engine.sort([{ x: 1 }, {}, { x: 2 }]);
    // Missing field = undefined = null behavior
    expect(result[0].x).toBeUndefined();
  });

  // --- Multi-key sorting ---

  it('multi-key: primary ascending, secondary descending', () => {
    const engine = createSortEngine({
      keys: [
        { field: 'group', direction: 'ascending' },
        { field: 'score', direction: 'descending' },
      ],
    });
    const items: Item[] = [
      { group: 'B', score: 10 },
      { group: 'A', score: 5 },
      { group: 'A', score: 10 },
      { group: 'B', score: 5 },
    ];
    const result = engine.sort(items);
    expect(result).toEqual([
      { group: 'A', score: 10 },
      { group: 'A', score: 5 },
      { group: 'B', score: 10 },
      { group: 'B', score: 5 },
    ]);
  });

  it('multi-key with different inversion per key', () => {
    const engine = createSortEngine({
      keys: [
        { field: 'group', direction: 'ascending', invertComparison: true },  // effectively descending
        { field: 'value', direction: 'ascending' },                          // normal ascending
      ],
    });
    const items: Item[] = [
      { group: 'A', value: 2 },
      { group: 'B', value: 1 },
      { group: 'A', value: 1 },
      { group: 'B', value: 2 },
    ];
    const result = engine.sort(items);
    // Groups descending (B first), values ascending within
    expect(result).toEqual([
      { group: 'B', value: 1 },
      { group: 'B', value: 2 },
      { group: 'A', value: 1 },
      { group: 'A', value: 2 },
    ]);
  });

  it('multi-key with nulls in different positions per key', () => {
    const engine = createSortEngine({
      keys: [
        { field: 'primary', direction: 'ascending', nulls: 'last' },
        { field: 'secondary', direction: 'ascending', nulls: 'first' },
      ],
    });
    const items: Item[] = [
      { primary: 'A', secondary: null },
      { primary: null, secondary: 1 },
      { primary: 'A', secondary: 1 },
    ];
    const result = engine.sort(items);
    // primary nulls last, secondary nulls first within same primary
    expect(result[0]).toEqual({ primary: 'A', secondary: null });
    expect(result[1]).toEqual({ primary: 'A', secondary: 1 });
    expect(result[2]).toEqual({ primary: null, secondary: 1 });
  });

  // --- Case sensitivity ---

  it('case-sensitive by default', () => {
    const engine = createSortEngine({
      keys: [{ field: 'name', direction: 'ascending' }],
    });
    const result = engine.sort([{ name: 'banana' }, { name: 'Apple' }]);
    // 'A' < 'b' in case-sensitive comparison
    expect(result[0].name).toBe('Apple');
  });

  it('case-insensitive comparison', () => {
    const engine = createSortEngine({
      keys: [{ field: 'name', direction: 'ascending', caseSensitive: false }],
    });
    const result = engine.sort([{ name: 'banana' }, { name: 'Apple' }]);
    expect(result.map(r => r.name)).toEqual(['Apple', 'banana']);
  });

  // --- Boolean sorting ---

  it('booleans: false < true', () => {
    const engine = createSortEngine({
      keys: [{ field: 'active', direction: 'ascending' }],
    });
    const result = engine.sort([{ active: true }, { active: false }]);
    expect(result.map(r => r.active)).toEqual([false, true]);
  });

  // --- Mixed types ---

  it('mixed types sorted by type name', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending' }],
    });
    const result = engine.sort([
      { x: 'hello' },
      { x: 42 },
      { x: true },
    ]);
    // "boolean" < "number" < "string"
    expect(result.map(r => r.x)).toEqual([true, 42, 'hello']);
  });

  // --- Does not mutate input ---

  it('sort returns new array, does not mutate input', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'ascending' }] });
    const input = [{ x: 3 }, { x: 1 }, { x: 2 }];
    const original = [...input];
    const result = engine.sort(input);
    expect(input).toEqual(original);
    expect(result).not.toBe(input);
  });

  // --- compare method ---

  it('compare returns negative for a < b', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'ascending' }] });
    expect(engine.compare({ x: 1 }, { x: 2 })).toBeLessThan(0);
  });

  it('compare returns positive for a > b', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'ascending' }] });
    expect(engine.compare({ x: 2 }, { x: 1 })).toBeGreaterThan(0);
  });

  it('compare returns 0 for equal items', () => {
    const engine = createSortEngine({ keys: [{ field: 'x', direction: 'ascending' }] });
    expect(engine.compare({ x: 1 }, { x: 1 })).toBe(0);
  });

  // --- Validation ---

  it('throws on empty keys', () => {
    expect(() => createSortEngine({ keys: [] })).toThrow('No sort keys provided');
  });

  it('throws on empty field name', () => {
    expect(() => createSortEngine({ keys: [{ field: '', direction: 'ascending' }] }))
      .toThrow('Empty field name');
  });

  // --- The truth table from the spec ---

  it('truth table: ascending + no inversion = natural order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', invertComparison: false }],
    });
    expect(engine.sort([{ x: 3 }, { x: 1 }]).map(r => r.x)).toEqual([1, 3]);
  });

  it('truth table: ascending + inversion = reversed order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'ascending', invertComparison: true }],
    });
    expect(engine.sort([{ x: 1 }, { x: 3 }]).map(r => r.x)).toEqual([3, 1]);
  });

  it('truth table: descending + no inversion = reversed order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', invertComparison: false }],
    });
    expect(engine.sort([{ x: 1 }, { x: 3 }]).map(r => r.x)).toEqual([3, 1]);
  });

  it('truth table: descending + inversion = natural order', () => {
    const engine = createSortEngine({
      keys: [{ field: 'x', direction: 'descending', invertComparison: true }],
    });
    expect(engine.sort([{ x: 3 }, { x: 1 }]).map(r => r.x)).toEqual([1, 3]);
  });
});
