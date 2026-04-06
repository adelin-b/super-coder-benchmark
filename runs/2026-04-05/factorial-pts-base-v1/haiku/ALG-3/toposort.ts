export type Edge<T> = [T, T];

export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleDetectedError';
  }
}

export function toposort<T>(nodes: T[], edges: Edge<T>[]): T[] {
  const graph = new Map<T, Set<T>>();
  const inDegree = new Map<T, number>();

  // Initialize graph
  for (const node of nodes) {
    graph.set(node, new Set());
    inDegree.set(node, 0);
  }

  // Build graph and compute in-degrees
  for (const [u, v] of edges) {
    if (!graph.has(u) || !graph.has(v)) {
      throw new Error(`Invalid edge: node not in graph`);
    }
    if (!graph.get(u)!.has(v)) {
      graph.get(u)!.add(v);
      inDegree.set(v, inDegree.get(v)! + 1);
    }
  }

  // Kahn's algorithm
  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: T[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    for (const v of graph.get(u)!) {
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // Detect cycle
  if (result.length !== nodes.length) {
    throw new CycleDetectedError();
  }

  return result;
}

export function hasCycle<T>(nodes: T[], edges: Edge<T>[]): boolean {
  try {
    toposort(nodes, edges);
    return false;
  } catch (error) {
    if (error instanceof CycleDetectedError) {
      return true;
    }
    throw error;
  }
}

export function topocyclePairs<T>(
  nodes: T[],
  edges: Edge<T>[]
): Edge<T>[] {
  const graph = new Map<T, Set<T>>();
  const inDegree = new Map<T, number>();

  for (const node of nodes) {
    graph.set(node, new Set());
    inDegree.set(node, 0);
  }

  for (const [u, v] of edges) {
    if (!graph.has(u) || !graph.has(v)) {
      throw new Error(`Invalid edge: node not in graph`);
    }
    if (!graph.get(u)!.has(v)) {
      graph.get(u)!.add(v);
      inDegree.set(v, inDegree.get(v)! + 1);
    }
  }

  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const processed = new Set<T>();
  while (queue.length > 0) {
    const u = queue.shift()!;
    processed.add(u);

    for (const v of graph.get(u)!) {
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  const cycleEdges: Edge<T>[] = [];
  for (const [u, v] of edges) {
    if (!processed.has(u) || !processed.has(v)) {
      cycleEdges.push([u, v]);
    }
  }

  return cycleEdges;
}