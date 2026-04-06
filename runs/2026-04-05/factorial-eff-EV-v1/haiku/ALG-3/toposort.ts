class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleError";
  }
}

type Graph<T> = Map<T, Set<T>>;

function toposort<T>(graph: Graph<T>): T[] {
  const visited = new Set<T>();
  const visiting = new Set<T>();
  const result: T[] = [];

  function dfs(node: T): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      throw new CycleError("Cycle detected in graph");
    }

    visiting.add(node);
    const neighbors = graph.get(node) || new Set<T>();
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    visiting.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result.reverse();
}

export { toposort, CycleError, Graph };