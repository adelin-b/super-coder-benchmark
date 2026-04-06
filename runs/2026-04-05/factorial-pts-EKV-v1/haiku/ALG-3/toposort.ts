export function toposort(nodes: string[], edges: [string, string][]): string[] {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error('Invalid input');
  }

  // Build adjacency list and in-degree map
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeSet = new Set(nodes);

  // Initialize
  for (const node of nodes) {
    graph.set(node, []);
    inDegree.set(node, 0);
  }

  // Process edges
  for (const [u, v] of edges) {
    if (!nodeSet.has(u) || !nodeSet.has(v)) {
      throw new Error(`Invalid edge: node not in graph`);
    }
    graph.get(u)!.push(v);
    inDegree.set(v, inDegree.get(v)! + 1);
  }

  // Kahn's algorithm - topological sort with cycle detection
  const queue: string[] = [];
  
  // Find all nodes with no incoming edges
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Reduce in-degree for all neighbors
    for (const neighbor of graph.get(node)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes were processed, there's a cycle
  if (result.length !== nodes.length) {
    throw new Error('Cycle detected');
  }

  return result;
}