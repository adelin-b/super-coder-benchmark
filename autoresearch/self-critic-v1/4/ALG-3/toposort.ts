export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort<T>(nodes: T[], edges: [T, T][]): T[] {
  // Build adjacency list
  const adjList = new Map<T, T[]>();
  for (const node of nodes) {
    adjList.set(node, []);
  }

  for (const [from, to] of edges) {
    if (!adjList.has(from) || !adjList.has(to)) {
      throw new Error('Edge references unknown node');
    }
    adjList.get(from)!.push(to);
  }

  // DFS with cycle detection
  const state = new Map<T, 0 | 1 | 2>(); // 0: white, 1: gray, 2: black
  const result: T[] = [];

  function visit(node: T): void {
    const currentState = state.get(node) ?? 0;
    
    if (currentState === 1) {
      // Gray node: back edge found, cycle detected
      throw new CycleError();
    }
    
    if (currentState === 2) {
      // Black node: already processed
      return;
    }

    // Mark as gray (in progress)
    state.set(node, 1);

    // Visit all neighbors
    for (const neighbor of adjList.get(node)!) {
      visit(neighbor);
    }

    // Mark as black (done)
    state.set(node, 2);
    result.push(node);
  }

  // Visit all nodes to ensure we process disconnected components
  for (const node of nodes) {
    if ((state.get(node) ?? 0) === 0) {
      visit(node);
    }
  }

  // Reverse to get correct topological order (DFS gives reverse order)
  return result.reverse();
}