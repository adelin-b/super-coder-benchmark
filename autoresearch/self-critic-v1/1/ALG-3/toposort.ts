export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleDetectedError';
  }
}

export function toposort(
  graph: Map<string, string[]> | Record<string, string[]>
): string[] {
  // Convert to Map if it's an object
  const adjList = graph instanceof Map ? graph : new Map(Object.entries(graph));

  // Get all nodes (including those that only appear as neighbors)
  const allNodes = new Set<string>();
  adjList.forEach((neighbors, node) => {
    allNodes.add(node);
    neighbors.forEach((n) => allNodes.add(n));
  });

  // Color states: 0 = white (unvisited), 1 = gray (visiting), 2 = black (visited)
  const colors = new Map<string, number>();
  const result: string[] = [];

  allNodes.forEach((node) => colors.set(node, 0));

  const visit = (node: string): void => {
    const color = colors.get(node) ?? 0;

    if (color === 1) {
      // Gray node means we found a back edge (cycle)
      throw new CycleDetectedError(`Cycle detected in graph`);
    }

    if (color === 0) {
      // Mark as visiting
      colors.set(node, 1);

      // Visit all neighbors
      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      // Mark as visited and add to result
      colors.set(node, 2);
      result.unshift(node);
    }
  };

  // Visit all nodes
  for (const node of allNodes) {
    if (colors.get(node) === 0) {
      visit(node);
    }
  }

  return result;
}