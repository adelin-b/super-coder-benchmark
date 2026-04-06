import { Effect, Data } from "effect";

export class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleError";
  }
}

export function topoSort<T extends string | number>(
  nodes: T[],
  edges: [T, T][]
): T[] {
  const program = Effect.gen(function* () {
    // Validate inputs
    if (nodes.length === 0) {
      return [];
    }

    const nodeSet = new Set(nodes);
    const adjList = new Map<T, T[]>();

    // Initialize adjacency list
    for (const node of nodes) {
      adjList.set(node, []);
    }

    // Build adjacency list and validate edges
    for (const [u, v] of edges) {
      if (!nodeSet.has(u) || !nodeSet.has(v)) {
        yield* Effect.fail(
          new CycleError("Edge references non-existent node")
        );
      }

      // Check for self-loop
      if (u === v) {
        yield* Effect.fail(new CycleError("Self-loop detected"));
      }

      const neighbors = adjList.get(u);
      if (neighbors) {
        neighbors.push(v);
      }
    }

    // Perform DFS-based cycle detection and topological sort
    const visited = new Set<T>();
    const recursionStack = new Set<T>();
    const result: T[] = [];

    const dfs = (node: T): Effect.Effect<void, CycleError> => {
      return Effect.gen(function* () {
        visited.add(node);
        recursionStack.add(node);

        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            yield* dfs(neighbor);
          } else if (recursionStack.has(neighbor)) {
            yield* Effect.fail(new CycleError("Cycle detected"));
          }
        }

        recursionStack.delete(node);
        result.push(node);
      });
    };

    // Process all nodes
    for (const node of nodes) {
      if (!visited.has(node)) {
        yield* dfs(node);
      }
    }

    // Reverse to get correct topological order
    return result.reverse();
  });

  return Effect.runSync(program);
}