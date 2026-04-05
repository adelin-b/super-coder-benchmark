export type Graph = Record<string, string[]> | Map<string, string[]>;

export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

export function toposort(graph: Graph): string[] {
  // Normalize to Map representation
  const graphMap = new Map<string, string[]>();
  
  if (graph instanceof Map) {
    for (const [key, values] of graph) {
      graphMap.set(key, values || []);
    }
  } else {
    for (const key in graph) {
      if (Object.prototype.hasOwnProperty.call(graph, key)) {
        graphMap.set(key, graph[key] || []);
      }
    }
  }

  // Collect all nodes (including those only appearing as targets)
  const allNodes = new Set<string>(graphMap.keys());
  for (const neighbors of graphMap.values()) {
    for (const neighbor of neighbors) {
      allNodes.add(neighbor);
    }
  }

  const visited = new Set<string>();
  const inProgress = new Set<string>();
  const result: string[] = [];

  function dfs(node: string): void {
    if (visited.has(node)) {
      return;
    }

    if (inProgress.has(node)) {
      throw new CycleError('Cycle detected in graph');
    }

    inProgress.add(node);

    const neighbors = graphMap.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    inProgress.delete(node);
    visited.add(node);
    result.push(node);
  }

  // Visit all nodes
  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  // Reverse to get correct topological order
  return result.reverse();
}