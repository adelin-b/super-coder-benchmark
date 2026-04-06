export function toposort<T>(graph: Map<T, T[]>): T[] {
  const visited = new Set<T>();
  const visiting = new Set<T>();
  const result: T[] = [];

  function visit(node: T): void {
    if (visiting.has(node)) {
      throw new Error("Cycle detected in graph");
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }
    visiting.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return result.reverse();
}