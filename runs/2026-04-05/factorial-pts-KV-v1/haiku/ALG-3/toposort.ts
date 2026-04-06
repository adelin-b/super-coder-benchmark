export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  if (!Array.isArray(nodes)) {
    throw new Error('nodes must be an array');
  }
  if (!Array.isArray(edges)) {
    throw new Error('edges must be an array');
  }

  const n = nodes.length;
  if (n === 0) {
    return [];
  }

  // Create a map from node to index
  const indices = new Map<any, number>();
  for (let i = 0; i < n; i++) {
    indices.set(nodes[i], i);
  }

  const inDegree = new Array(n).fill(0);
  const adj: Set<number>[] = nodes.map(() => new Set());

  // Build adjacency list
  for (const [from, to] of edges) {
    const fromIdx = indices.get(from);
    const toIdx = indices.get(to);

    if (fromIdx === undefined) {
      throw new Error('Invalid edge: source node not in nodes array');
    }
    if (toIdx === undefined) {
      throw new Error('Invalid edge: target node not in nodes array');
    }

    // Avoid counting duplicate edges multiple times
    if (!adj[fromIdx].has(toIdx)) {
      adj[fromIdx].add(toIdx);
      inDegree[toIdx]++;
    }
  }

  // Kahn's algorithm
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) {
      queue.push(i);
    }
  }

  const result: T[] = [];
  while (queue.length > 0) {
    const idx = queue.shift()!;
    result.push(nodes[idx]);

    for (const neighborIdx of adj[idx]) {
      inDegree[neighborIdx]--;
      if (inDegree[neighborIdx] === 0) {
        queue.push(neighborIdx);
      }
    }
  }

  if (result.length !== n) {
    throw new Error('Cycle detected in directed graph');
  }

  return result;
}