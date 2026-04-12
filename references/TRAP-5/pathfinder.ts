export interface Edge {
  from: string;
  to: string;
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

// State in BFS: (node, parity). Parity 0 = even (product +1), parity 1 = odd (product -1)
type Parity = 0 | 1;

export function shortestPath(graph: Graph, start: string, end: string): PathResult {
  // Validation
  const nodeSet = new Set(graph.nodes);
  if (!nodeSet.has(start)) throw new Error('Start node not in graph');
  if (!nodeSet.has(end)) throw new Error('End node not in graph');
  for (const edge of graph.edges) {
    if (edge.weight !== 1 && edge.weight !== -1) {
      throw new Error('Invalid edge weight');
    }
  }

  // Start === end: immediate return
  if (start === end) {
    // Still need to check for negative cycles reachable from start
    const negCycle = detectNegativeCycle(graph, start, nodeSet);
    return {
      found: true,
      path: [start],
      weight: 1,
      length: 0,
      negativeCycleDetected: negCycle,
    };
  }

  // Build adjacency list
  const adj = new Map<string, { to: string; weight: 1 | -1 }[]>();
  for (const node of graph.nodes) {
    adj.set(node, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.from)!.push({ to: edge.to, weight: edge.weight });
  }

  // BFS on (node, parity) state space
  // Parity: 0 = even number of -1 edges (product = +1), 1 = odd (product = -1)
  // We want to reach (end, 0) first (product +1), then (end, 1) as fallback

  // visited[node][parity] = { prevNode, prevParity } for path reconstruction
  const visited = new Map<string, [
    { prev: string | null; prevParity: Parity } | null,
    { prev: string | null; prevParity: Parity } | null
  ]>();

  for (const node of graph.nodes) {
    visited.set(node, [null, null]);
  }

  // Queue: [node, parity]
  const queue: [string, Parity][] = [];

  // Start at (start, 0) — even parity (no edges traversed, product = +1)
  visited.get(start)![0] = { prev: null, prevParity: 0 };
  queue.push([start, 0]);

  let endEvenDist = Infinity;
  let endOddDist = Infinity;
  const dist = new Map<string, [number, number]>();
  for (const node of graph.nodes) {
    dist.set(node, [Infinity, Infinity]);
  }
  dist.get(start)![0] = 0;

  let head = 0;
  while (head < queue.length) {
    const [node, parity] = queue[head++];
    const d = dist.get(node)![parity];

    // Early termination: if we've found even parity at end, and current distance exceeds it
    if (d > endEvenDist) continue;
    // If we've found both, no need to continue
    if (endEvenDist < Infinity && endOddDist < Infinity) continue;

    const edges = adj.get(node);
    if (!edges) continue;

    for (const { to, weight } of edges) {
      const newParity: Parity = weight === -1 ? (1 - parity as Parity) : parity;
      const newDist = d + 1;

      if (visited.get(to)![newParity] === null) {
        visited.get(to)![newParity] = { prev: node, prevParity: parity };
        dist.get(to)![newParity] = newDist;
        queue.push([to, newParity]);

        if (to === end) {
          if (newParity === 0) endEvenDist = newDist;
          else endOddDist = newDist;
        }
      }
    }
  }

  // Detect negative cycles reachable from start
  const negCycle = detectNegativeCycleFromBFS(graph, adj, nodeSet, start);

  // Pick best result: prefer even parity (weight +1), then shorter
  let chosenParity: Parity | null = null;
  if (endEvenDist < Infinity) {
    chosenParity = 0;
  } else if (endOddDist < Infinity) {
    chosenParity = 1;
  }

  if (chosenParity === null) {
    return {
      found: false,
      path: [],
      weight: 0,
      length: 0,
      negativeCycleDetected: negCycle,
    };
  }

  // Reconstruct path
  const path: string[] = [];
  let curNode = end;
  let curParity = chosenParity;
  while (curNode !== null) {
    path.push(curNode);
    const entry = visited.get(curNode)![curParity];
    if (!entry || entry.prev === null) break;
    curNode = entry.prev;
    curParity = entry.prevParity;
  }
  path.reverse();

  const weight = chosenParity === 0 ? 1 : -1;

  return {
    found: true,
    path,
    weight,
    length: path.length - 1,
    negativeCycleDetected: negCycle,
  };
}

function detectNegativeCycle(
  graph: Graph,
  start: string,
  nodeSet: Set<string>,
): boolean {
  const adj = new Map<string, { to: string; weight: 1 | -1 }[]>();
  for (const node of graph.nodes) {
    adj.set(node, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.from)!.push({ to: edge.to, weight: edge.weight });
  }
  return detectNegativeCycleFromBFS(graph, adj, nodeSet, start);
}

function detectNegativeCycleFromBFS(
  _graph: Graph,
  adj: Map<string, { to: string; weight: 1 | -1 }[]>,
  _nodeSet: Set<string>,
  start: string,
): boolean {
  // A negative cycle exists if any node reachable from start can be reached
  // with both even and odd parity. Because then you can go around the cycle
  // and flip parity, meaning the cycle has odd number of -1 edges.
  const reachable = new Map<string, [boolean, boolean]>();

  // BFS from start tracking parity
  const queue: [string, Parity][] = [[start, 0]];
  reachable.set(start, [true, false]);

  let head = 0;
  while (head < queue.length) {
    const [node, parity] = queue[head++];
    const edges = adj.get(node);
    if (!edges) continue;

    for (const { to, weight } of edges) {
      const newParity: Parity = weight === -1 ? (1 - parity as Parity) : parity;
      if (!reachable.has(to)) {
        reachable.set(to, [false, false]);
      }
      const r = reachable.get(to)!;
      if (!r[newParity]) {
        r[newParity] = true;
        queue.push([to, newParity]);
      }
    }
  }

  // If any node is reachable with both parities, a negative cycle exists
  for (const [, [even, odd]] of reachable) {
    if (even && odd) return true;
  }
  return false;
}
