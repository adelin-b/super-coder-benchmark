export type GraphNode = string | number;
export type Graph = Map<GraphNode, GraphNode[]>;

export function toposort(graph: Graph): GraphNode[] {
  const visited = new Set<GraphNode>();
  const recursionStack = new Set<GraphNode>();
  const result: GraphNode[] = [];

  // Collect all nodes (including those appearing only as targets)
  const allNodes = new Set<GraphNode>();
  for (const [node, neighbors] of graph) {
    allNodes.add(node);
    for (const neighbor of neighbors) {
      allNodes.add(neighbor);
    }
  }

  function dfs(node: GraphNode): void {
    if (recursionStack.has(node)) {
      throw new Error(`Cycle detected`);
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    recursionStack.delete(node);
    result.push(node);
  }

  // Visit all nodes
  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result.reverse();
}