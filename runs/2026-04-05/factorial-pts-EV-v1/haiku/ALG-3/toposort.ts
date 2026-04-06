export function topologicalSort<T>(graph: Map<T, T[]>): T[] {
  const visited = new Set<T>();
  const recursionStack = new Set<T>();
  const result: T[] = [];

  const dfs = (node: T): void => {
    if (recursionStack.has(node)) {
      throw new Error('Cycle detected');
    }
    if (visited.has(node)) {
      return;
    }

    recursionStack.add(node);
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    recursionStack.delete(node);

    visited.add(node);
    result.push(node);
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result.reverse();
}