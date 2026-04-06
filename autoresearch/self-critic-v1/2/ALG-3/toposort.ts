export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort<T>(nodes: T[], edges: Array<[T, T]>): T[] {
  // Build adjacency list and in-degree map
  const adj = new Map<T, T[]>();
  const inDegree = new Map<T, number>();
  
  for (const node of nodes) {
    adj.set(node, []);
    inDegree.set(node, 0);
  }
  
  for (const [u, v] of edges) {
    adj.get(u)!.push(v);
    inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
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
    
    for (const v of adj.get(u) ?? []) {
      inDegree.set(v, (inDegree.get(v) ?? 0) - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }
  
  // If not all nodes were processed, a cycle exists
  if (result.length !== nodes.length) {
    throw new CycleError();
  }
  
  return result;
}