import { describe, it, expect } from 'vitest';
import { topoSort, CycleError } from './toposort.js';

describe('ALG-3: Topological Sort', () => {
  it('linear chain', () => {
    expect(topoSort(['a','b','c'], [['a','b'],['b','c']])).toEqual(['a','b','c']);
  });
  it('diamond DAG', () => {
    const r = topoSort(['a','b','c','d'], [['a','b'],['a','c'],['b','d'],['c','d']]);
    expect(r.indexOf('a')).toBeLessThan(r.indexOf('b'));
    expect(r.indexOf('a')).toBeLessThan(r.indexOf('c'));
    expect(r.indexOf('b')).toBeLessThan(r.indexOf('d'));
    expect(r.indexOf('c')).toBeLessThan(r.indexOf('d'));
  });
  it('no edges = any order', () => {
    const r = topoSort(['a','b','c'], []);
    expect(r).toHaveLength(3);
  });
  it('single node', () => {
    expect(topoSort(['x'], [])).toEqual(['x']);
  });
  it('detects cycle', () => {
    expect(() => topoSort(['a','b','c'], [['a','b'],['b','c'],['c','a']])).toThrow(CycleError);
  });
  it('detects self-loop', () => {
    expect(() => topoSort(['a'], [['a','a']])).toThrow(CycleError);
  });
  it('respects all edges', () => {
    const r = topoSort(['a','b','c','d'], [['d','a'],['d','b'],['a','c']]);
    expect(r.indexOf('d')).toBeLessThan(r.indexOf('a'));
    expect(r.indexOf('d')).toBeLessThan(r.indexOf('b'));
    expect(r.indexOf('a')).toBeLessThan(r.indexOf('c'));
  });
});
