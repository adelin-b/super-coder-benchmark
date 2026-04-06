import { Effect, Exit, Cause } from "effect";

export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

function topoSortInternal(
  edges: Array<[string, string]>
): Effect.Effect<string[], CycleDetectedError> {
  return Effect.gen(function* () {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    const nodes = new Set<string>();

    // Build graph
    for (const [u, v] of edges) {
      nodes.add(u);
      nodes.add(v);
      inDegree.set(u, (inDegree.get(u) ?? 0));
      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);

      if (!adj.has(u)) adj.set(u, []);
      adj.get(u)!.push(v);
    }

    // Initialize queue with 0 in-degree nodes (Kahn's algorithm)
    const queue: string[] = [];
    for (const node of nodes) {
      if ((inDegree.get(node) ?? 0) === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const neighbor of adj.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we haven't processed all nodes, there's a cycle
    if (result.length !== nodes.size) {
      yield* Effect.fail(new CycleDetectedError());
    }

    return result;
  });
}

export function topoSort(edges: Array<[string, string]>): string[] {
  const exit = Effect.runSyncExit(topoSortInternal(edges));
  if (Exit.isFailure(exit)) {
    throw Cause.squash(exit.cause);
  }
  return exit.value;
}