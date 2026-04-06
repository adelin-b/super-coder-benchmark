export function toposort<T>(nodes: T[], edges: [T, T][]): T[] {
  if (!Array.isArray(nodes)) {
    throw new Error("nodes must be an array");
  }
  if (!Array.isArray(edges)) {
    throw new Error("edges must be an array");
  }

  // Handle empty graph
  if (nodes.length === 0) {
    return [];
  }

  // Build adjacency list
  const graph = new Map<T, T[]>();
  const nodeSet = new Set(nodes);

  for (const node of nodes) {
    graph.set(node, []);
  }

  for (const [u, v] of edges) {
    if (!nodeSet.has(u)) {
      throw new Error("Edge source node not in nodes list");
    }
    if (!nodeSet.has(v)) {
      throw new Error("Edge target node not in nodes list");
    }
    graph.get(u)!.push(v);
  }

  // DFS-based topological sort with cycle detection
  const result: T[] = [];
  const color = new Map<T, "white" | "gray" | "black">();

  for (const node of nodes) {
    color.set(node, "white");
  }

  function dfs(node: T): void {
    const currentColor = color.get(node);

    if (currentColor === "gray") {
      throw new Error("Cycle detected in directed graph");
    }

    if (currentColor === "black") {
      return;
    }

    color.set(node, "gray");
    const neighbors = graph.get(node);

    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
    }

    color.set(node, "black");
    result.push(node);
  }

  for (const node of nodes) {
    if (color.get(node) === "white") {
      dfs(node);
    }
  }

  return result.reverse();
}