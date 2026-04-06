export function toposort<T>(edges: Array<[T, T]>): T[] {
  // Validate input
  if (!Array.isArray(edges)) {
    throw new Error('Edges must be an array');
  }

  if (edges.length === 0) {
    return [];
  }

  const graph = new Map<T, T[]>();
  const inDegree = new Map<T, number>();
  const nodes = new Set<T>();

  // Build graph and calculate in-degrees
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2) {
      throw new Error('Each edge must be a [source, target] tuple');
    }

    const [u, v] = edge;

    // Detect self-loops (which are cycles)
    if (u === v) {
      throw new Error('Cycle detected');
    }

    nodes.add(u);
    nodes.add(v);

    if (!graph.has(u)) {
      graph.set(u, []);
    }
    graph.get(u)!.push(v);

    inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    if (!inDegree.has(u)) {
      inDegree.set(u, 0);
    }
  }

  // Kahn's algorithm: process nodes with in-degree 0
  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: T[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    const neighbors = graph.get(u) ?? [];
    for (const v of neighbors) {
      const newDegree = inDegree.get(v)! - 1;
      inDegree.set(v, newDegree);
      if (newDegree === 0) {
        queue.push(v);
      }
    }
  }

  // Detect cycles: if not all nodes were processed, a cycle exists
  if (result.length !== nodes.size) {
    throw new Error('Cycle detected');
  }

  return result;
}