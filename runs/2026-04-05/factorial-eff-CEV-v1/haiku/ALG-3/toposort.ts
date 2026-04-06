export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleDetectedError';
  }
}

export function toposort(graph: Record<string, string[]>): string[] {
  // Input validation
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new Error('Graph must be a non-null object');
  }

  const inDegree = new Map<string, number>();
  const nodes = new Set<string>();
  const adjList: Record<string, string[]> = {};

  // Collect all source nodes and build adjacency list
  for (const node in graph) {
    if (Object.prototype.hasOwnProperty.call(graph, node)) {
      nodes.add(node);
      inDegree.set(node, 0);

      const neighbors = graph[node];
      if (!Array.isArray(neighbors)) {
        throw new Error(`Value for node "${node}" must be an array`);
      }

      adjList[node] = neighbors;
    }
  }

  // Calculate in-degrees and collect all reachable nodes
  for (const node in adjList) {
    for (const target of adjList[node]) {
      if (typeof target !== 'string') {
        throw new Error('All edge targets must be strings');
      }
      nodes.add(target);
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  }

  // Ensure all nodes have an in-degree entry
  for (const node of nodes) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
  }

  // Kahn's algorithm: process nodes with in-degree 0
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const neighbors = adjList[node] || [];
    for (const neighbor of neighbors) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Detect cycle: if not all nodes were processed, there's a cycle
  if (sorted.length !== nodes.size) {
    throw new CycleDetectedError();
  }

  return sorted;
}