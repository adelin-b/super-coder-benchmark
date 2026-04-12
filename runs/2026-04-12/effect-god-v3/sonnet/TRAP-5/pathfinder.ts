import { Effect, Exit, Cause, Data } from "effect";

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
  found: boolean;
  path: string[];
  weight: number;
  length: number;
  negativeCycleDetected: boolean;
}

type Parity = 0 | 1; // 0 = even = product +1, 1 = odd = product -1
type AdjMap = Map<string, Array<{ to: string; weight: 1 | -1 }>>;

const stateKey = (node: string, parity: Parity): string => `${node}:${parity}`;

function buildAdj(graph: Graph): AdjMap {
  const adj: AdjMap = new Map();
  for (const node of graph.nodes) adj.set(node, []);
  for (const edge of graph.edges) {
    const list = adj.get(edge.from);
    if (list) list.push({ to: edge.to, weight: edge.weight });
  }
  return adj;
}

function bfsDoubled(
  start: string,
  adj: AdjMap
): {
  visited: Map<string, boolean>;
  parent: Map<string, { node: string; parity: Parity } | null>;
} {
  const visited = new Map<string, boolean>();
  const parent = new Map<string, { node: string; parity: Parity } | null>();

  const initialKey = stateKey(start, 0);
  visited.set(initialKey, true);
  parent.set(initialKey, null);

  const queue: Array<{ node: string; parity: Parity }> = [{ node: start, parity: 0 }];

  while (queue.length > 0) {
    const { node, parity } = queue.shift()!;
    const neighbors = adj.get(node) ?? [];
    for (const { to, weight } of neighbors) {
      const newParity: Parity = weight === -1 ? (parity === 0 ? 1 : 0) : parity;
      const key = stateKey(to, newParity);
      if (!visited.has(key)) {
        visited.set(key, true);
        parent.set(key, { node, parity });
        queue.push({ node: to, parity: newParity });
      }
    }
  }

  return { visited, parent };
}

function detectNegativeCycle(start: string, adj: AdjMap): boolean {
  // Find all nodes reachable from start in the original graph
  const reachable = new Set<string>();
  const q: string[] = [start];
  reachable.add(start);
  while (q.length > 0) {
    const node = q.shift()!;
    for (const { to } of adj.get(node) ?? []) {
      if (!reachable.has(to)) {
        reachable.add(to);
        q.push(to);
      }
    }
  }

  // For each reachable node v, check if (v,1) is reachable from (v,0) in doubled graph
  for (const v of reachable) {
    const vis = new Set<string>();
    const bq: Array<{ node: string; parity: Parity }> = [{ node: v, parity: 0 }];
    vis.add(stateKey(v, 0));

    while (bq.length > 0) {
      const { node, parity } = bq.shift()!;
      for (const { to, weight } of adj.get(node) ?? []) {
        const newParity: Parity = weight === -1 ? (parity === 0 ? 1 : 0) : parity;
        // Check for negative cycle: reached v with flipped parity (odd number of -1 edges cycle)
        if (to === v && newParity === 1) return true;
        const key = stateKey(to, newParity);
        if (!vis.has(key)) {
          vis.add(key);
          bq.push({ node: to, parity: newParity });
        }
      }
    }
  }

  return false;
}

function reconstructPath(
  end: string,
  finalParity: Parity,
  parent: Map<string, { node: string; parity: Parity } | null>
): string[] {
  const path: string[] = [];
  let curr: { node: string; parity: Parity } | null = { node: end, parity: finalParity };

  while (curr !== null) {
    path.unshift(curr.node);
    const p = parent.get(stateKey(curr.node, curr.parity));
    // p is null at start node (sentinel), undefined if key missing (shouldn't happen)
    curr = p !== undefined ? p : null;
  }

  return path;
}

export function shortestPath(graph: Graph, start: string, end: string): PathResult {
  // Validation
  if (!graph.nodes.includes(start)) throw new Error("Start node not in graph");
  if (!graph.nodes.includes(end)) throw new Error("End node not in graph");
  for (const edge of graph.edges) {
    if (edge.weight !== 1 && edge.weight !== -1) throw new Error("Invalid edge weight");
  }

  const adj = buildAdj(graph);

  // Special case: start === end — empty path, weight = 1 (product identity)
  if (start === end) {
    const negativeCycleDetected = detectNegativeCycle(start, adj);
    return { found: true, path: [start], weight: 1, length: 0, negativeCycleDetected };
  }

  const { visited, parent } = bfsDoubled(start, adj);
  const negativeCycleDetected = detectNegativeCycle(start, adj);

  const foundPos = visited.has(stateKey(end, 0));
  const foundNeg = visited.has(stateKey(end, 1));

  if (!foundPos && !foundNeg) {
    return { found: false, path: [], weight: 0, length: 0, negativeCycleDetected };
  }

  // Prefer parity 0 (weight +1) over parity 1 (weight -1)
  const finalParity: Parity = foundPos ? 0 : 1;
  const weight = finalParity === 0 ? 1 : -1;

  const path = reconstructPath(end, finalParity, parent);

  return {
    found: true,
    path,
    weight,
    length: path.length - 1,
    negativeCycleDetected,
  };
}