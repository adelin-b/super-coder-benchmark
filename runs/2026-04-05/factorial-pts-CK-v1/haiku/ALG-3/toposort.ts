export type Graph<T> = Map<T, T[]>;

export function toposort<T>(graph: Graph<T>): T[] {
  if (!graph || graph.size === 0) {
    return [];
  }

  const visited = new Set<T>();
  const recursionStack = new Set<T>();
  const sorted: T[] = [];

  const dfs = (node: T): void => {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (recursionStack.has(neighbor)) {
          throw new Error(`Cycle detected: ${String(neighbor)} is in recursion stack`);
        }
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
    }

    recursionStack.delete(node);
    sorted.push(node);
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return sorted.reverse();
}

export function detectCycle<T>(graph: Graph<T>): boolean {
  if (!graph || graph.size === 0) {
    return false;
  }

  const visited = new Set<T>();
  const recursionStack = new Set<T>();

  const hasCycle = (node: T): boolean => {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (recursionStack.has(neighbor)) {
          return true;
        }
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        }
      }
    }

    recursionStack.delete(node);
    return false;
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        return true;
      }
    }
  }

  return false;
}