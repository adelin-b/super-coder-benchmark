export type Graph<T> = Map<T, T[]>;

enum Color {
  WHITE = 0,
  GRAY = 1,
  BLACK = 2,
}

export function toposort<T>(graph: Graph<T>): T[] {
  const result: T[] = [];
  const colors = new Map<T, Color>();

  for (const node of graph.keys()) {
    colors.set(node, Color.WHITE);
  }

  const visit = (node: T): boolean => {
    const color = colors.get(node);
    if (color === Color.GRAY) {
      return false; // Cycle detected
    }
    if (color === Color.BLACK) {
      return true; // Already visited
    }

    colors.set(node, Color.GRAY);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visit(neighbor)) {
        return false;
      }
    }

    colors.set(node, Color.BLACK);
    result.push(node);
    return true;
  };

  for (const node of graph.keys()) {
    if (colors.get(node) === Color.WHITE) {
      if (!visit(node)) {
        throw new Error("Cycle detected in graph");
      }
    }
  }

  return result.reverse();
}

export function hasCycle<T>(graph: Graph<T>): boolean {
  const colors = new Map<T, Color>();

  for (const node of graph.keys()) {
    colors.set(node, Color.WHITE);
  }

  const visit = (node: T): boolean => {
    const color = colors.get(node);
    if (color === Color.GRAY) {
      return true; // Cycle detected
    }
    if (color === Color.BLACK) {
      return false; // Already visited
    }

    colors.set(node, Color.GRAY);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (visit(neighbor)) {
        return true;
      }
    }

    colors.set(node, Color.BLACK);
    return false;
  };

  for (const node of graph.keys()) {
    if (colors.get(node) === Color.WHITE) {
      if (visit(node)) {
        return true;
      }
    }
  }

  return false;
}