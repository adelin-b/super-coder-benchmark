export interface Graph {
  [node: string]: string[];
}

export function toposort(graph: Graph): string[] {
  if (!graph || typeof graph !== 'object') {
    throw new Error('Graph must be a valid object');
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      throw new Error('Cycle detected in graph');
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    const neighbors = graph[node];
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!Array.isArray(neighbors)) {
          throw new Error('Invalid graph: adjacency list must be an array');
        }
        dfs(neighbor);
      }
    }
    visiting.delete(node);
    visited.add(node);
    result.push(node);
  }

  // Collect all nodes (both keys and referenced in adjacency lists)
  const allNodes = new Set<string>();
  for (const node in graph) {
    allNodes.add(node);
    const neighbors = graph[node];
    if (!Array.isArray(neighbors)) {
      throw new Error('Invalid graph: adjacency list must be an array');
    }
    for (const neighbor of neighbors) {
      if (typeof neighbor !== 'string') {
        throw new Error('Invalid graph: nodes must be strings');
      }
      allNodes.add(neighbor);
    }
  }

  // Run DFS from each unvisited node
  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return result.reverse();
}