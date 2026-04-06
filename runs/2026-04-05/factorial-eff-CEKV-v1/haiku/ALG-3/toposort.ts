export function toposort<T>(nodes: T[], edges: Array<[T, T]>): T[] {
  if (nodes.length === 0) {
    return [];
  }

  const inDegree = new Map<T, number>();
  const adjacency = new Map<T, Set<T>>();
  const nodeSet = new Set(nodes);

  // Initialize maps
  nodes.forEach((node) => {
    inDegree.set(node, 0);
    adjacency.set(node, new Set());
  });

  // Build graph and compute in-degrees
  edges.forEach(([from, to]) => {
    if (!nodeSet.has(from) || !nodeSet.has(to)) {
      throw new Error("Edge references non-existent node");
    }

    const neighbors = adjacency.get(from)!;
    if (!neighbors.has(to)) {
      neighbors.add(to);
      inDegree.set(to, inDegree.get(to)! + 1);
    }
  });

  // Kahn's algorithm: collect all nodes with in-degree 0
  const queue: T[] = [];
  inDegree.forEach((degree, node) => {
    if (degree === 0) {
      queue.push(node);
    }
  });

  const result: T[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Reduce in-degree for all neighbors
    adjacency.get(node)!.forEach((neighbor) => {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Detect cycle: if not all nodes were processed, a cycle exists
  if (result.length !== nodes.length) {
    throw new Error("Cycle detected in graph");
  }

  return result;
}