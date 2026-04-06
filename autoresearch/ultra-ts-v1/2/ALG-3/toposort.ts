export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort(nodes: string[], edges: [string, string][]): string[] {
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const node of nodes) {
    graph[node] = [];
    inDegree[node] = 0;
  }

  for (const [u, v] of edges) {
    if (!(u in graph)) graph[u] = [];
    if (!(v in graph)) graph[v] = [];
    graph[u].push(v);
    inDegree[v]++;
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighbor of graph[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== nodes.length) {
    throw new CycleError();
  }

  return sorted;
}