export function topoSort(
  nodes: string[],
  edges: [string, string][]
): string[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node, 0);
    adjacencyList.set(node, []);
  }

  // Build graph
  for (const [u, v] of edges) {
    if (!inDegree.has(u) || !inDegree.has(v)) {
      throw new Error("Edge references undefined node");
    }
    adjacencyList.get(u)!.push(v);
    inDegree.set(v, inDegree.get(v)! + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of adjacencyList.get(node)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
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