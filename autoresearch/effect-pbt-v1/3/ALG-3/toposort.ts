export function toposort(edges: Array<[any, any]>): any[] {
  // Build adjacency list and collect all nodes
  const graph = new Map<any, any[]>();
  const allNodes = new Set<any>();

  for (const [u, v] of edges) {
    allNodes.add(u);
    allNodes.add(v);
    if (!graph.has(u)) {
      graph.set(u, []);
    }
    graph.get(u)!.push(v);
  }

  // DFS-based topological sort with cycle detection
  // States: 0 = unvisited (white), 1 = visiting (gray), 2 = done (black)
  const state = new Map<any, number>();
  const result: any[] = [];

  const visit = (node: any): void => {
    const nodeState = state.get(node) ?? 0;

    if (nodeState === 2) {
      // Already processed
      return;
    }

    if (nodeState === 1) {
      // Back edge detected — cycle!
      throw new Error("Cycle detected");
    }

    // Mark as visiting
    state.set(node, 1);

    // Visit all neighbors
    for (const neighbor of graph.get(node) || []) {
      visit(neighbor);
    }

    // Mark as done and add to result (postorder)
    state.set(node, 2);
    result.unshift(node);
  };

  // Visit all nodes
  for (const node of allNodes) {
    const nodeState = state.get(node) ?? 0;
    if (nodeState === 0) {
      visit(node);
    }
  }

  return result;
}