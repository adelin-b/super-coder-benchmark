export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
    Object.setPrototypeOf(this, CycleError.prototype);
  }
}

export function toposort(graph: Record<string, string[]>): string[] {
  if (!graph || typeof graph !== 'object') {
    throw new Error('Invalid graph');
  }

  const colors = new Map<string, 'white' | 'gray' | 'black'>();
  const stack: string[] = [];
  let cycleDetected = false;

  // Collect all nodes from graph keys and values
  const allNodes = new Set<string>();
  for (const [node, neighbors] of Object.entries(graph)) {
    allNodes.add(node);
    if (Array.isArray(neighbors)) {
      for (const neighbor of neighbors) {
        allNodes.add(neighbor);
      }
    }
  }

  const dfs = (node: string): void => {
    if (cycleDetected) return;

    const color = colors.get(node) || 'white';
    if (color === 'black') return;
    if (color === 'gray') {
      cycleDetected = true;
      return;
    }

    colors.set(node, 'gray');

    const neighbors = graph[node];
    if (Array.isArray(neighbors)) {
      for (const neighbor of neighbors) {
        if (!cycleDetected) {
          dfs(neighbor);
        }
      }
    }

    colors.set(node, 'black');
    stack.push(node);
  };

  // Visit all nodes
  for (const node of allNodes) {
    if ((colors.get(node) || 'white') === 'white') {
      dfs(node);
      if (cycleDetected) {
        throw new CycleError();
      }
    }
  }

  return stack.reverse();
}

export function hasCycle(graph: Record<string, string[]>): boolean {
  try {
    toposort(graph);
    return false;
  } catch (e) {
    if (e instanceof CycleError) {
      return true;
    }
    throw e;
  }
}