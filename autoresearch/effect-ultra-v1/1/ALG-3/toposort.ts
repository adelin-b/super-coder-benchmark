import { Effect, Data, pipe } from "effect";

class CycleDetected extends Data.TaggedError("CycleDetected")<{}> {}

function topoSortInternal(
  nodes: string[],
  edges: [string, string][]
): Effect.Effect<string[], CycleDetected> {
  return Effect.gen(function* () {
    if (nodes.length === 0) {
      return [];
    }

    // Build adjacency list and in-degree map
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node, 0);
      adjacencyList.set(node, []);
    }

    for (const [from, to] of edges) {
      if (!inDegree.has(from) || !inDegree.has(to)) {
        yield* Effect.fail(new CycleDetected({}));
      }
      adjacencyList.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    for (const node of nodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const neighbor of adjacencyList.get(node) || []) {
        const newInDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newInDegree);

        if (newInDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== nodes.length) {
      yield* Effect.fail(new CycleDetected({}));
    }

    return result;
  });
}

export function topoSort(
  nodes: string[],
  edges: [string, string][]
): string[] {
  if (nodes.length === 0) {
    return [];
  }

  if (!Array.isArray(nodes)) {
    throw new Error("nodes must be an array");
  }

  if (!Array.isArray(edges)) {
    throw new Error("edges must be an array");
  }

  try {
    return Effect.runSync(topoSortInternal(nodes, edges));
  } catch (error) {
    if (error instanceof Error && error.message.includes("CycleDetected")) {
      throw new Error("Cycle detected in graph");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Topological sort failed");
  }
}