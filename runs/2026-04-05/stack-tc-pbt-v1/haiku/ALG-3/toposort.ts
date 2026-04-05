export type Edge<T> = [from: T, to: T];

export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

export function topologicalSort<T>(edges: Edge<T>[]): T[] {
  if (edges.length === 0) {
    return [];
  }

  // Build adjacency list and collect all nodes
  const graph = new Map<T, T[]>();
  const nodes = new Set<T>();

  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
    if (!graph.has(from)) {
      graph.set(from, []);
    }
    graph.get(from)!.push(to);
  }

  // Ensure all nodes are in the graph
  for (const node of nodes) {
    if (!graph.has(node)) {
      graph.set(node, []);
    }
  }

  // DFS-based topological sort with cycle detection
  const color = new Map<T, "white" | "gray" | "black">();
  const result: T[] = [];

  // Initialize all nodes as white
  for (const node of nodes) {
    color.set(node, "white");
  }

  const visit = (node: T): void => {
    const nodeColor = color.get(node);

    if (nodeColor === "gray") {
      // Back edge found - cycle detected
      throw new CycleDetectedError(`Cycle detected involving node: ${String(node)}`);
    }

    if (nodeColor === "white") {
      color.set(node, "gray");

      // Visit all neighbors
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      color.set(node, "black");
      result.unshift(node); // Prepend to result
    }
  };

  // Visit all nodes
  for (const node of nodes) {
    if (color.get(node) === "white") {
      visit(node);
    }
  }

  return result;
}

export function hasCycle<T>(edges: Edge<T>[]): boolean {
  try {
    topologicalSort(edges);
    return false;
  } catch (error) {
    if (error instanceof CycleDetectedError) {
      return true;
    }
    throw error;
  }
}