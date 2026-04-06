export interface ToposortResult<T> {
  sorted: T[];
  hasCycle: boolean;
}

export function toposort<T>(graph: Map<T, T[]>): ToposortResult<T> {
  if (!graph) {
    return { sorted: [], hasCycle: false };
  }

  const inDegree = new Map<T, number>();
  const allNodes = new Set<T>();

  // Collect all nodes and compute in-degrees
  for (const [node, neighbors] of graph) {
    allNodes.add(node);
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    if (neighbors) {
      for (const neighbor of neighbors) {
        allNodes.add(neighbor);
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
      }
    }
  }

  // Find all nodes with in-degree 0
  const queue: T[] = [];
  for (const node of allNodes) {
    if ((inDegree.get(node) ?? 0) === 0) {
      queue.push(node);
    }
  }

  // Kahn's algorithm: process nodes in topological order
  const sorted: T[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (neighbor === undefined || neighbor === null) continue;
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes were processed, there's a cycle
  const hasCycle = sorted.length !== allNodes.size;

  return {
    sorted: hasCycle ? [] : sorted,
    hasCycle
  };
}