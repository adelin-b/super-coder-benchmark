import { Effect } from "effect";

function toposortInternal(
  nodes: string[],
  edges: Array<[string, string]>
): Effect.Effect<string[], Error> {
  return Effect.gen(function* () {
    // Build adjacency list and in-degree map
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeSet = new Set(nodes);

    // Initialize
    for (const node of nodes) {
      adj.set(node, []);
      inDegree.set(node, 0);
    }

    // Process edges
    for (const [from, to] of edges) {
      if (!nodeSet.has(from) || !nodeSet.has(to)) {
        yield* Effect.fail(new Error("Invalid edge: node not in graph"));
      }
      adj.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const node of nodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      sorted.push(node);

      for (const neighbor of adj.get(node)!) {
        const deg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Cycle detection: if not all nodes were processed, a cycle exists
    if (sorted.length !== nodes.length) {
      yield* Effect.fail(new Error("Cycle detected in graph"));
    }

    return sorted;
  });
}

export function toposort(
  nodes: string[],
  edges: Array<[string, string]>
): string[] {
  // Input validation
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("nodes must be a non-empty array");
  }
  if (!Array.isArray(edges)) {
    throw new Error("edges must be an array");
  }

  return Effect.runSync(toposortInternal(nodes, edges));
}