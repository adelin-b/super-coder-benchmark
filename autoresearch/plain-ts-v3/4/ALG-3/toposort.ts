export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CycleError';
  }
}

export type Graph = Map<string, string[]>;

export function createGraph(): Graph {
  return new Map();
}

export function addEdge(graph: Graph, from: string, to: string): void {
  if (!graph.has(from)) {
    graph.set(from, []);
  }
  graph.get(from)!.push(to);
  if (!graph.has(to)) {
    graph.set(to, []);
  }
}

export function topologicalSort(graph: Graph): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const result: string[] = [];

  function visit(node: string): void {
    if (recursionStack.has(node)) {
      throw new CycleError(`Cycle detected`);
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }

    recursionStack.delete(node);
    result.unshift(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return result;
}

export function hasCycle(graph: Graph): boolean {
  try {
    topologicalSort(graph);
    return false;
  } catch (error) {
    if (error instanceof CycleError) {
      return true;
    }
    throw error;
  }
}