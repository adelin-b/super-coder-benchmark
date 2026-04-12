import { describe, it, expect } from 'vitest';
import { validateBrackets } from './brackets.js';

describe('TRAP-2: Validate Brackets (Familiar Surface, Different Depth)', () => {
  // --- Basic: standard stack-based would pass ---

  it('empty string is valid', () => {
    const r = validateBrackets('');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(0);
    expect(r.overlaps).toEqual([]);
  });

  it('simple matched parentheses', () => {
    const r = validateBrackets('()');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(1);
    expect(r.overlaps).toEqual([]);
  });

  it('nested brackets', () => {
    const r = validateBrackets('[{()}]');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(3);
    expect(r.overlaps).toEqual([]);
  });

  it('consecutive pairs', () => {
    const r = validateBrackets('[]{}()');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(1);
    expect(r.overlaps).toEqual([]);
  });

  it('unmatched opening bracket', () => {
    const r = validateBrackets('([');
    expect(r.valid).toBe(false);
  });

  it('unmatched closing bracket', () => {
    const r = validateBrackets(')');
    expect(r.valid).toBe(false);
  });

  it('wrong closing type with standard nesting', () => {
    // Standard stack would say (] is invalid because ] doesn't match (
    // But our algorithm: ] looks for most recent unmatched [, finds none -> invalid
    const r = validateBrackets('(]');
    expect(r.valid).toBe(false);
  });

  // --- TRAP: Overlapping brackets (stack-based FAILS these) ---

  it('overlapping [{]} is VALID', () => {
    // Stack-based: pushes [, pushes {, sees ] -> top is { -> MISMATCH -> invalid
    // Correct: [ matches ], { matches } -> valid, with overlap
    const r = validateBrackets('[{]}');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(2);
    expect(r.overlaps).toEqual([['[]', '{}']]);
  });

  it('overlapping ({)} is VALID', () => {
    const r = validateBrackets('({)}');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(2);
    expect(r.overlaps).toEqual([['()', '{}']]);
  });

  it('overlapping [(]) is VALID', () => {
    const r = validateBrackets('[(])');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(2);
    expect(r.overlaps).toEqual([['()', '[]']]);
  });

  it('triple overlap [{(]}) is VALID', () => {
    // [ at 0, { at 1, ( at 2, ] at 3, } at 4, ) at 5
    // [ matches ], { matches }, ( matches )
    // Pairs: [0,3], {1,4}, (2,5)
    // Overlaps: [0,3] crosses {1,4}, [0,3] crosses (2,5), {1,4} crosses (2,5)
    const r = validateBrackets('[{(]})');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(3);
    expect(r.overlaps).toHaveLength(3);
    expect(r.overlaps).toContainEqual(['()', '[]']);
    expect(r.overlaps).toContainEqual(['()', '{}']);
    expect(r.overlaps).toContainEqual(['[]', '{}']);
  });

  it('overlapping same-type brackets do not count as overlap', () => {
    // [[]] — properly nested, no overlap
    const r = validateBrackets('[[]]');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(2);
    expect(r.overlaps).toEqual([]);
  });

  it('multiple separate overlapping pairs', () => {
    // [{]}({)}
    // First: [ at 0, { at 1, ] at 2, } at 3 -> overlap []{}
    // Second: ( at 4, { at 5, ) at 6, } at 7 -> overlap (){}
    const r = validateBrackets('[{]}({)}');
    expect(r.valid).toBe(true);
    expect(r.overlaps).toContainEqual(['[]', '{}']);
    expect(r.overlaps).toContainEqual(['()', '{}']);
  });

  it('non-bracket characters are ignored', () => {
    const r = validateBrackets('hello [world {foo] bar}');
    expect(r.valid).toBe(true);
    expect(r.overlaps).toEqual([['[]', '{}']]);
  });

  it('only non-bracket characters', () => {
    const r = validateBrackets('hello world');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(0);
    expect(r.overlaps).toEqual([]);
  });

  it('deeply nested same type', () => {
    const r = validateBrackets('[[[[]]]]');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(4);
    expect(r.overlaps).toEqual([]);
  });

  it('overlapping with depth tracking', () => {
    // [{]} -> depth goes: 1, 2, 1, 0. maxDepth = 2
    const r = validateBrackets('[{]}');
    expect(r.maxDepth).toBe(2);
  });

  it('complex valid overlapping: [({])}', () => {
    // [ at 0, ( at 1, { at 2, ] at 3, ) at 4, } at 5
    // [ matches ], ( matches ), { matches }
    // Pairs: [0,3], (1,4), {2,5}
    // [0,3] crosses (1,4): 0<1<3<4 -> yes
    // [0,3] crosses {2,5}: 0<2<3<5 -> yes
    // (1,4) crosses {2,5}: 1<2<4<5 -> yes
    const r = validateBrackets('[({])}');
    expect(r.valid).toBe(true);
    expect(r.maxDepth).toBe(3);
    expect(r.overlaps).toHaveLength(3);
  });

  it('partially overlapping: [{}] with no overlap', () => {
    // [ at 0, { at 1, } at 2, ] at 3
    // Pairs: [0,3], {1,2}. {1,2} is fully inside [0,3] -> not overlapping
    const r = validateBrackets('[{}]');
    expect(r.valid).toBe(true);
    expect(r.overlaps).toEqual([]);
  });

  it('invalid: unmatched opener after overlap', () => {
    const r = validateBrackets('[{]}(');
    expect(r.valid).toBe(false);
  });

  it('invalid: extra closer after overlap', () => {
    const r = validateBrackets('[{]})');
    expect(r.valid).toBe(false);
  });

  it('overlaps are sorted alphabetically', () => {
    // Ensure the pair order is always alphabetical
    const r = validateBrackets('[{(]})');
    // Should be: ["()", "[]"], ["()", "{}"], ["[]", "{}"]
    expect(r.overlaps[0]).toEqual(['()', '[]']);
    expect(r.overlaps[1]).toEqual(['()', '{}']);
    expect(r.overlaps[2]).toEqual(['[]', '{}']);
  });

  it('same overlap type pair appears only once', () => {
    // Two separate instances of []{} overlap
    const r = validateBrackets('[{]}[{]}');
    expect(r.valid).toBe(true);
    // Only one ["[]", "{}"] pair in overlaps
    const filtered = r.overlaps.filter(
      ([a, b]) => a === '[]' && b === '{}'
    );
    expect(filtered).toHaveLength(1);
  });

  it('stack algorithm gives wrong validity for overlapping brackets', () => {
    // This is the core trap: a stack-based algorithm would reject these
    // as invalid, but they are all valid under overlap semantics
    const overlappingCases = ['[{]}', '({)}', '[(])'];
    for (const s of overlappingCases) {
      const r = validateBrackets(s);
      expect(r.valid).toBe(true);
    }
  });

  it('maxDepth with overlapping is based on open count at any point', () => {
    // [{]} -> at position 0: depth 1, position 1: depth 2, position 2: depth 1 (] closes [), position 3: depth 0
    const r = validateBrackets('[{]}');
    expect(r.maxDepth).toBe(2);
  });

  it('long string with many overlaps', () => {
    // [{]}({)}[(])
    const r = validateBrackets('[{]}({)}[(])');
    expect(r.valid).toBe(true);
    expect(r.overlaps).toContainEqual(['[]', '{}']);
    expect(r.overlaps).toContainEqual(['()', '{}']);
    expect(r.overlaps).toContainEqual(['()', '[]']);
  });
});
