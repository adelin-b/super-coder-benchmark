export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleDetectedError';
  }
}

export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  // Build adjacency list
  const adjList = new Map<T, T[]>();
  const nodeSet = new Set(nodes);

  // Initialize adjacency list for all nodes
  for (const node of nodes) {
    adjList.set(node, []);
  }

  // Add edges
  for (const [u, v] of edges) {
    if (!nodeSet.has(u) || !nodeSet.has(v)) {
      throw new Error('Edge references non-existent node');
    }
    adjList.get(u)!.push(v);
  }

  // Track states: 0 = unvisited, 1 = visiting, 2 = visited
  const state = new Map<T, number>();
  const result: T[] = [];

  // Initialize all nodes as unvisited
  for (const node of nodes) {
    state.set(node, 0);
  }

  // DFS with cycle detection
  function dfs(node: T): void {
    const nodeState = state.get(node);

    if (nodeState === 1) {
      // Node is in current recursion stack - cycle detected
      throw new CycleDetectedError();
    }

    if (nodeState === 2) {
      // Node already fully processed
      return;
    }

    // Mark as visiting
    state.set(node, 1);

    // Visit all neighbors
    for (const neighbor of adjList.get(node) || []) {
      dfs(neighbor);
    }

    // Mark as visited
    state.set(node, 2);
    result.push(node);
  }

  // Process all nodes
  for (const node of nodes) {
    if (state.get(node) === 0) {
      dfs(node);
    }
  }

  // Reverse to get correct topological order
  return result.reverse();
}