import { Effect, Data } from 'effect';

// Error class for cycle detection
export class CycleError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleError';
  }
}

// Internal Effect-based implementation
function topoSortInternal(
  nodes: string[],
  edges: Array<[string, string]>
): Effect.Effect<string[], CycleError, never> {
  return Effect.gen(function* () {
    // Build adjacency list and in-degree map
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize all nodes
    for (const node of nodes) {
      adjList.set(node, []);
      inDegree.set(node, 0);
    }

    // Process edges
    for (const [from, to] of edges) {
      // Check for self-loop
      if (from === to) {
        yield* Effect.fail(new CycleError('Self-loop detected'));
      }

      const neighbors = adjList.get(from);
      if (neighbors) {
        neighbors.push(to);
      }

      // Increment in-degree
      const currentInDegree = inDegree.get(to) || 0;
      inDegree.set(to, currentInDegree + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];

    // Find all nodes with in-degree 0
    for (const node of nodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Process neighbors
      const neighbors = adjList.get(current) || [];
      for (const neighbor of neighbors) {
        const newInDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newInDegree);

        if (newInDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check if all nodes were processed (no cycle)
    if (result.length !== nodes.length) {
      yield* Effect.fail(new CycleError('Cycle detected in graph'));
    }

    return result;
  });
}

// Public API with plain TypeScript
export function topoSort(
  nodes: string[],
  edges: Array<[string, string]>
): string[] {
  // Validate input
  if (!nodes || nodes.length === 0) {
    throw new Error('Nodes array cannot be empty');
  }

  try {
    return Effect.runSync(topoSortInternal(nodes, edges));
  } catch (e: unknown) {
    // Re-throw as is if it's already CycleError
    if (e instanceof CycleError) {
      throw e;
    }
    // Re-throw as plain Error, never leak FiberFailure
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}