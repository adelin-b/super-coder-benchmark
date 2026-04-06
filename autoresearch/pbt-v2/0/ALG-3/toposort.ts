export type Graph<T> = Map<T, T[]>;

export interface ToposortResult<T> {
  sorted: T[];
  hasCycle: boolean;
}

export function toposort<T>(graph: Graph<T>): ToposortResult<T> {
  const visited = new Set<T>();
  const stack: T[] = [];
  const recStack = new Set<T>();
  let hasCycle = false;

  const visit = (node: T): void => {
    if (recStack.has(node)) {
      hasCycle = true;
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }

    recStack.delete(node);
    stack.push(node);
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  stack.reverse();
  return {
    sorted: stack,
    hasCycle,
  };
}