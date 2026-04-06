export class CycleError extends Error {
  constructor(message: string = 'Cycle detected') {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort(nodes: string[], edges: [string, string][]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  }

  // Build graph
  for (const [from, to] of edges) {
    adjacency.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }

  // Find all nodes with in-degree 0
  const queue: string[] = [];
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  // Kahn's algorithm: process nodes with in-degree 0
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of adjacency.get(node)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes processed, there's a cycle
  if (result.length !== nodes.length) {
    throw new CycleError();
  }

  return result;
}