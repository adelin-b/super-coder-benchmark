export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort(edges: Array<[string, string]>): string[] {
  if (!Array.isArray(edges)) {
    throw new TypeError('edges must be an array');
  }

  // Build adjacency list and collect all nodes
  const graph = new Map<string, string[]>();
  const nodes = new Set<string>();

  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2) {
      throw new TypeError('each edge must be a [from, to] tuple');
    }

    const [from, to] = edge;

    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new TypeError('edge nodes must be strings');
    }

    if (!from || !to) {
      throw new Error('edge nodes cannot be empty');
    }

    nodes.add(from);
    nodes.add(to);

    if (!graph.has(from)) {
      graph.set(from, []);
    }
    graph.get(from)!.push(to);
  }

  // Color states for DFS: 0=white (unvisited), 1=gray (visiting), 2=black (visited)
  const color = new Map<string, number>();
  const result: string[] = [];

  for (const node of nodes) {
    color.set(node, 0);
  }

  function dfs(node: string): void {
    color.set(node, 1); // Mark as gray (visiting)

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor);

      if (neighborColor === 1) {
        // Gray node encountered: cycle detected
        throw new CycleError(`Cycle detected in graph`);
      }

      if (neighborColor === 0) {
        // White node: continue DFS
        dfs(neighbor);
      }
      // If black (2), already processed, skip
    }

    color.set(node, 2); // Mark as black (visited)
    result.push(node); // Add to result in post-order
  }

  // Run DFS from all unvisited nodes
  for (const node of nodes) {
    if (color.get(node) === 0) {
      dfs(node);
    }
  }

  // Reverse to get topological order (DFS gives reverse postorder)
  return result.reverse();
}