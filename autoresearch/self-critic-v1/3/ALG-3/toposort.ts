export function topoSort(
  nodes: string[],
  edges: [string, string][]
): string[] {
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // Initialize graph and in-degrees
  for (const node of nodes) {
    graph[node] = [];
    inDegree[node] = 0;
  }

  // Build graph and calculate in-degrees
  for (const [u, v] of edges) {
    graph[u].push(v);
    inDegree[v]++;
  }

  // Kahn's algorithm with cycle detection
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of graph[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Detect cycle
  if (result.length !== nodes.length) {
    throw new Error("Cycle detected in graph");
  }

  return result;
}