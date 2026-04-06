export type Graph<T> = Map<T, T[]>;

export function toposort<T>(graph: Graph<T>): T[] {
  const visited = new Set<T>();
  const visiting = new Set<T>();
  const result: T[] = [];
  const allNodes = new Set<T>();

  // Collect all nodes (both keys and destinations)
  for (const [node, neighbors] of graph.entries()) {
    allNodes.add(node);
    for (const neighbor of neighbors) {
      allNodes.add(neighbor);
    }
  }

  function dfs(node: T): void {
    if (visiting.has(node)) {
      throw new Error('Cycle detected in graph');
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    visiting.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result.reverse();
}