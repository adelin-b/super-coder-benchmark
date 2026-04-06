export function topoSort(
  graph: Record<string, string[]>
): { sorted: string[]; hasCycle: boolean } {
  const visited = new Map<string, "white" | "gray" | "black">();
  const result: string[] = [];
  let hasCycle = false;

  // Initialize all nodes as white (unvisited)
  const allNodes = new Set<string>();
  Object.entries(graph).forEach(([node, neighbors]) => {
    allNodes.add(node);
    neighbors.forEach((n) => allNodes.add(n));
  });

  allNodes.forEach((node) => {
    visited.set(node, "white");
  });

  const dfs = (node: string): void => {
    if (visited.get(node) === "gray") {
      // Back edge detected - cycle found
      hasCycle = true;
      return;
    }

    if (visited.get(node) === "black") {
      // Already processed
      return;
    }

    visited.set(node, "gray");

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, "white");
      }
      dfs(neighbor);
    }

    visited.set(node, "black");
    result.push(node);
  };

  // Run DFS from all unvisited nodes
  for (const node of allNodes) {
    if (visited.get(node) === "white") {
      dfs(node);
    }
  }

  return {
    sorted: result.reverse(),
    hasCycle,
  };
}