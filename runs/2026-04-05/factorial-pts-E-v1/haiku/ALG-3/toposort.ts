export class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleError";
  }
}

export function toposort<T>(nodes: T[], edges: [T, T][]): T[] {
  const nodeSet = new Set(nodes);
  const adjList = new Map<T, T[]>();
  const result: T[] = [];
  const colors = new Map<T, number>(); // 0: white, 1: gray, 2: black

  // Initialize adjacency list and colors
  for (const node of nodes) {
    adjList.set(node, []);
    colors.set(node, 0);
  }

  // Build adjacency list from edges
  for (const [u, v] of edges) {
    if (!nodeSet.has(u) || !nodeSet.has(v)) {
      throw new Error("Edge references node not in nodes list");
    }
    adjList.get(u)!.push(v);
  }

  // DFS function with cycle detection
  const visit = (node: T): void => {
    const color = colors.get(node)!;

    if (color === 1) {
      // Gray node - back edge, cycle detected
      throw new CycleError();
    }

    if (color === 2) {
      // Black node - already processed
      return;
    }

    // Mark as gray (visiting)
    colors.set(node, 1);

    // Visit all neighbors
    for (const neighbor of adjList.get(node)!) {
      visit(neighbor);
    }

    // Mark as black (visited) and add to result
    colors.set(node, 2);
    result.push(node);
  };

  // Visit all nodes
  for (const node of nodes) {
    if (colors.get(node) === 0) {
      visit(node);
    }
  }

  // Reverse to get topological order (we built it in reverse postorder)
  return result.reverse();
}