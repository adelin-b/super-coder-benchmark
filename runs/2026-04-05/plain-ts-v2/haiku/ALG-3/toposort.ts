// Custom error class for cycle detection
export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

// Type for graph represented as adjacency list
export type Graph<T> = Map<T, Set<T>>;

/**
 * Performs topological sort on a DAG using Kahn's algorithm.
 * Returns nodes in topological order where every edge u→v has u before v.
 * Throws CycleDetectedError if the graph contains a cycle.
 *
 * @param nodes - Array of all nodes in the graph
 * @param edges - Array of directed edges [from, to]
 * @returns Array of nodes in topological order
 * @throws CycleDetectedError if a cycle is detected
 * @throws Error if an edge references a non-existent node
 */
export function topologicalSort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  // Build adjacency list and calculate in-degrees
  const graph: Graph<T> = new Map();
  const inDegree = new Map<T, number>();

  // Initialize graph and in-degrees
  for (const node of nodes) {
    graph.set(node, new Set());
    inDegree.set(node, 0);
  }

  // Build graph from edges
  for (const [u, v] of edges) {
    if (!graph.has(u) || !graph.has(v)) {
      throw new Error("Edge references non-existent node");
    }
    graph.get(u)!.add(v);
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
  }

  // Find all nodes with in-degree 0
  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  // Process nodes in topological order
  const sorted: T[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    sorted.push(u);

    // Reduce in-degree of neighbors
    for (const v of graph.get(u)!) {
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // If not all nodes were processed, a cycle exists
  if (sorted.length !== nodes.length) {
    throw new CycleDetectedError();
  }

  return sorted;
}