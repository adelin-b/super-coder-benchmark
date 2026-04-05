export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
  }
}

export interface Graph {
  nodes: string[];
  edges: [string, string][];
}

export function toposort(graph: Graph): string[] {
  const { nodes, edges } = graph;

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node, []);
    inDegree.set(node, 0);
  }

  for (const [u, v] of edges) {
    if (!adjacency.has(u)) {
      adjacency.set(u, []);
      inDegree.set(u, 0);
    }
    if (!adjacency.has(v)) {
      adjacency.set(v, []);
      inDegree.set(v, 0);
    }
    adjacency.get(u)!.push(v);
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
  }

  const allNodes = Array.from(adjacency.keys());
  const queue: string[] = [];
  for (const node of allNodes) {
    if ((inDegree.get(node) ?? 0) === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== allNodes.length) {
    const cycle = findCycle(adjacency);
    throw new CycleError(cycle);
  }

  return result;
}

function findCycle(adjacency: Map<string, string[]>): string[] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of adjacency.keys()) {
    color.set(node, WHITE);
    parent.set(node, null);
  }

  let cycleStart: string | null = null;
  let cycleEnd: string | null = null;

  function dfs(u: string): boolean {
    color.set(u, GRAY);
    for (const v of adjacency.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        cycleStart = v;
        cycleEnd = u;
        return true;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }
    color.set(u, BLACK);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) {
      if (dfs(node)) break;
    }
  }

  if (cycleStart === null || cycleEnd === null) {
    return [];
  }

  const cycle: string[] = [];
  let current: string | null = cycleEnd;
  while (current !== null && current !== cycleStart) {
    cycle.push(current);
    current = parent.get(current) ?? null;
  }
  cycle.push(cycleStart);
  cycle.reverse();
  cycle.push(cycleStart);

  return cycle;
}