export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in topological sort") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

export function toposort<T>(nodes: T[], edges: [T, T][]): T[] {
  const adjList = new Map<T, T[]>();
  const inDegree = new Map<T, number>();

  // Initialize all nodes
  for (const node of nodes) {
    adjList.set(node, []);
    inDegree.set(node, 0);
  }

  // Build adjacency list and in-degree map
  for (const [u, v] of edges) {
    if (!adjList.has(u)) {
      adjList.set(u, []);
    }
    if (!adjList.has(v)) {
      adjList.set(v, 0);
    }
    adjList.get(u)!.push(v);
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
  }

  // Find all nodes with in-degree 0
  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: T[] = [];

  // Process nodes with in-degree 0
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    // Reduce in-degree for all neighbors
    for (const v of adjList.get(u) ?? []) {
      const newDegree = (inDegree.get(v) ?? 0) - 1;
      inDegree.set(v, newDegree);
      if (newDegree === 0) {
        queue.push(v);
      }
    }
  }

  // Check if all nodes were processed (no cycle)
  if (result.length !== nodes.length) {
    throw new CycleDetectedError(
      "Graph contains a cycle and cannot be topologically sorted"
    );
  }

  return result;
}