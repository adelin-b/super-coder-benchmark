import { describe, it, expect } from 'vitest';
import { shortestPath, Graph } from './pathfinder.js';

describe('TRAP-5: Pathfinder (Unpuzzle Pattern)', () => {
  // --- Basic cases ---

  it('start equals end returns immediately', () => {
    const graph: Graph = { nodes: ['A'], edges: [] };
    const result = shortestPath(graph, 'A', 'A');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['A']);
    expect(result.weight).toBe(1);
    expect(result.length).toBe(0);
  });

  it('single +1 edge', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [{ from: 'A', to: 'B', weight: 1 }],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['A', 'B']);
    expect(result.weight).toBe(1);
    expect(result.length).toBe(1);
  });

  it('single -1 edge: weight is -1', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [{ from: 'A', to: 'B', weight: -1 }],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['A', 'B']);
    expect(result.weight).toBe(-1);
    expect(result.length).toBe(1);
  });

  it('no path exists', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.weight).toBe(0);
    expect(result.length).toBe(0);
  });

  // --- THE TRAP: Product of weights, not sum ---

  it('two -1 edges: product is +1 (not sum of -2)', () => {
    // Bellman-Ford would compute sum = -2 and prefer this path for "shortest"
    // Correct: product = (-1)*(-1) = +1
    const graph: Graph = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'C', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'C');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1); // product: (-1)*(-1) = 1
    expect(result.length).toBe(2);
  });

  it('prefers +1 weight path over -1 weight path even if longer', () => {
    // Path 1: A->B (weight -1, length 1)
    // Path 2: A->C->B (weight +1*+1 = +1, length 2)
    // Correct: prefer path 2 (weight +1 > -1)
    // Bellman-Ford would prefer path 1 (sum -1 < sum 2)
    const graph: Graph = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'A', to: 'C', weight: 1 },
        { from: 'C', to: 'B', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1);
    expect(result.length).toBe(2);
    expect(result.path).toEqual(['A', 'C', 'B']);
  });

  it('prefers shorter +1 path over longer +1 path', () => {
    // Both paths have weight +1, prefer shorter
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: 1 },           // A->B: length 1, weight +1
        { from: 'A', to: 'C', weight: -1 },
        { from: 'C', to: 'D', weight: -1 },
        { from: 'D', to: 'B', weight: 1 },            // A->C->D->B: length 3, weight +1
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1);
    expect(result.length).toBe(1); // Shorter path
  });

  it('parity problem: even count of -1 edges gives +1', () => {
    // A->B->C->D->E with weights [-1, -1, -1, -1] -> product = +1
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D', 'E'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'C', weight: -1 },
        { from: 'C', to: 'D', weight: -1 },
        { from: 'D', to: 'E', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'E');
    expect(result.weight).toBe(1); // 4 negatives -> positive
  });

  it('parity problem: odd count of -1 edges gives -1', () => {
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'C', weight: -1 },
        { from: 'C', to: 'D', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.weight).toBe(-1); // 3 negatives -> negative
  });

  it('chooses +1 path via longer route over short -1 path', () => {
    // Direct: A->E weight -1 (length 1)
    // Longer: A->B->C->D->E weights [1,1,1,1] product +1 (length 4)
    // Correct: longer route because +1 > -1
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D', 'E'],
      edges: [
        { from: 'A', to: 'E', weight: -1 },
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'C', to: 'D', weight: 1 },
        { from: 'D', to: 'E', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'E');
    expect(result.weight).toBe(1);
    expect(result.length).toBe(4);
  });

  it('when only -1 paths exist, picks shortest -1 path', () => {
    // Path 1: A->B weight -1, length 1
    // Path 2: A->C->D->B weights [-1,-1,-1] product -1, length 3
    // Both weight -1, prefer shorter
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'A', to: 'C', weight: -1 },
        { from: 'C', to: 'D', weight: -1 },
        { from: 'D', to: 'B', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.weight).toBe(-1);
    expect(result.length).toBe(1);
  });

  // --- Negative cycle detection ---

  it('self-loop with -1 is a negative cycle', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'A', weight: -1 },
        { from: 'A', to: 'B', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.negativeCycleDetected).toBe(true);
  });

  it('self-loop with +1 is NOT a negative cycle', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'A', weight: 1 },
        { from: 'A', to: 'B', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.negativeCycleDetected).toBe(false);
  });

  it('cycle with odd -1 edges is negative cycle', () => {
    // A->B(-1)->C(+1)->A: product = -1, odd parity -> negative cycle
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'C', to: 'A', weight: 1 },
        { from: 'A', to: 'D', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.found).toBe(true);
    expect(result.negativeCycleDetected).toBe(true);
  });

  it('cycle with even -1 edges is NOT negative cycle', () => {
    // A->B(-1)->C(-1)->A: product = +1, even parity -> not negative
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'C', weight: -1 },
        { from: 'C', to: 'A', weight: 1 },
        { from: 'A', to: 'D', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.negativeCycleDetected).toBe(false);
  });

  it('negative cycle reachable but not on path to end', () => {
    // A -> B (cycle B->C->B with -1) and A -> D
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: -1 },
        { from: 'C', to: 'B', weight: 1 },
        { from: 'A', to: 'D', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1);
    expect(result.negativeCycleDetected).toBe(true);
  });

  it('unreachable negative cycle is not detected', () => {
    // Negative cycle at C->D->C but unreachable from A
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'C', to: 'D', weight: -1 },
        { from: 'D', to: 'C', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.negativeCycleDetected).toBe(false);
  });

  // --- Validation ---

  it('throws if start not in graph', () => {
    const graph: Graph = { nodes: ['A'], edges: [] };
    expect(() => shortestPath(graph, 'X', 'A')).toThrow('Start node not in graph');
  });

  it('throws if end not in graph', () => {
    const graph: Graph = { nodes: ['A'], edges: [] };
    expect(() => shortestPath(graph, 'A', 'X')).toThrow('End node not in graph');
  });

  it('throws on invalid edge weight', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [{ from: 'A', to: 'B', weight: 2 as any }],
    };
    expect(() => shortestPath(graph, 'A', 'B')).toThrow('Invalid edge weight');
  });

  // --- Complex scenarios ---

  it('diamond graph: prefers +1 path', () => {
    //   A
    //  / \
    // B   C  (A->B: -1, A->C: +1)
    //  \ /
    //   D    (B->D: +1, C->D: -1)
    // Path A->B->D: (-1)*(+1) = -1
    // Path A->C->D: (+1)*(-1) = -1
    // Both paths have weight -1 and length 2
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'A', to: 'C', weight: 1 },
        { from: 'B', to: 'D', weight: 1 },
        { from: 'C', to: 'D', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(-1);
    expect(result.length).toBe(2);
  });

  it('longer +1 path beats shorter -1 path in complex graph', () => {
    // A->B: -1 (direct, length 1, weight -1)
    // A->C->D->B: +1,+1,+1 (length 3, weight +1)
    // A->E->B: -1,-1 (length 2, weight +1) <- shortest +1 path!
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D', 'E'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'A', to: 'C', weight: 1 },
        { from: 'C', to: 'D', weight: 1 },
        { from: 'D', to: 'B', weight: 1 },
        { from: 'A', to: 'E', weight: -1 },
        { from: 'E', to: 'B', weight: -1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.weight).toBe(1);
    expect(result.length).toBe(2); // A->E->B
  });

  it('disconnected subgraphs', () => {
    const graph: Graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'C', to: 'D', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'D');
    expect(result.found).toBe(false);
  });

  it('start equals end with reachable negative cycle', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'B', to: 'A', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'A');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1);
    expect(result.length).toBe(0);
    expect(result.negativeCycleDetected).toBe(true);
  });

  it('multiple edges between same nodes with different weights', () => {
    const graph: Graph = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'B', weight: -1 },
        { from: 'A', to: 'B', weight: 1 },
      ],
    };
    const result = shortestPath(graph, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.weight).toBe(1); // prefer +1 edge
    expect(result.length).toBe(1);
  });
});
