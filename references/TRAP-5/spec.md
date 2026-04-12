# TRAP-5: Pathfinder

## Overview
Implement a shortest path algorithm for a weighted directed graph. The graph has edges with weights of either `+1` or `-1`. A path's total weight is the **product** of its edge weights (not the sum). Find the shortest path from start to end, where "shortest" means the path with the **highest product weight** (closest to +1).

## Exported API

```ts
export interface Edge {
  from: string;
  to: string;
  /** Weight is always +1 or -1 */
  weight: 1 | -1;
}

export interface Graph {
  nodes: string[];
  edges: Edge[];
}

export interface PathResult {
  /** Whether a path exists from start to end */
  found: boolean;
  /** The sequence of nodes in the shortest path (including start and end) */
  path: string[];
  /** The product of all edge weights along the path. 1 or -1 for found paths, 0 if not found. */
  weight: number;
  /** Total number of edges in the path */
  length: number;
  /** Whether a negative cycle is reachable from start */
  negativeCycleDetected: boolean;
}

export function shortestPath(graph: Graph, start: string, end: string): PathResult;
```

## Detailed Requirements

### Weight Semantics
- Each edge has weight `+1` or `-1`.
- A path's weight is the **product** of all edge weights along the path.
- Since weights are only +1 or -1, the product is always +1 (even number of -1 edges) or -1 (odd number of -1 edges).
- An empty path (start === end) has weight +1 (product identity) and length 0.

### "Shortest" Path Definition
The best path is determined by:
1. **Prefer weight +1 over weight -1.** A path that arrives with positive parity is always preferred over one with negative parity, regardless of length.
2. **Among paths with the same weight, prefer fewer edges.** Shorter paths are better.
3. If multiple paths have the same weight and length, any one is acceptable.

### Algorithm Insight
Since weights are only +1 or -1 and we multiply:
- The path's weight depends only on the **parity** (even/odd count) of -1 edges.
- This is equivalent to a BFS on a "doubled" state graph: each node has two states — "even parity" (product = +1) and "odd parity" (product = -1).
- From state (node, even), a +1 edge goes to (neighbor, even) and a -1 edge goes to (neighbor, odd).
- From state (node, odd), a +1 edge goes to (neighbor, odd) and a -1 edge goes to (neighbor, even).

### Negative Cycle Detection
- A "negative cycle" is a cycle whose product of edge weights is -1 (odd number of -1 edges in the cycle).
- Set `negativeCycleDetected` to true if such a cycle is **reachable from start** (the cycle doesn't need to be on the path to end).
- To detect: if any node reachable from start can be reached with both even and odd parity via a cycle (i.e., there is a cycle with odd parity count of -1 edges), a negative cycle exists.

### Path Reconstruction
- If `found` is true, `path` contains the sequence of node IDs from `start` to `end` inclusive.
- If `found` is false, `path` is empty.
- If `start === end`, `path` is `[start]`, weight is `1`, length is `0`.

### Validation
- If `start` is not in `graph.nodes`, throw `Error("Start node not in graph")`.
- If `end` is not in `graph.nodes`, throw `Error("End node not in graph")`.
- Edge weights must be +1 or -1. Throw `Error("Invalid edge weight")` otherwise.

### Edge Cases
- Self-loops: An edge from A to A with weight -1 is a negative cycle.
- Disconnected graph: If no path exists, return `found: false`.
- Start equals end: return immediately with weight 1, length 0.
- Multiple edges between same nodes with different weights.

## Invariants
1. If `found` is true, `path[0] === start` and `path[path.length-1] === end`.
2. If `found` is true, `weight` is `+1` or `-1`.
3. If `found` is false, `weight` is `0` and `path` is `[]`.
4. `length` equals `path.length - 1` when found, `0` when not found.
5. `negativeCycleDetected` is independent of whether a path to end exists.
