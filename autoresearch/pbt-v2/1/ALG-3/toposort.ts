export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  const graph = new Map<T, T[]>();

  // Initialize adjacency list
  for (const node of nodes) {
    graph.set(node, []);
  }

  // Build graph from edges
  for (const [u, v] of edges) {
    if (!graph.has(u)) {
      graph.set(u, []);
    }
    graph.get(u)!.push(v);
  }

  const visited = new Set<T>();
  const recursionStack = new Set<T>();
  const result: T[] = [];

  const visit = (node: T): void => {
    if (recursionStack.has(node)) {
      throw new Error("Cycle detected in graph");
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);

    for (const neighbor of graph.get(node) || []) {
      visit(neighbor);
    }

    recursionStack.delete(node);
    result.push(node);
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return result.reverse();
}