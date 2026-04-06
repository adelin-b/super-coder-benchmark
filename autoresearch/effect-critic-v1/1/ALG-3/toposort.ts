import { Effect, Data, pipe } from "effect";

interface Edge {
  from: string;
  to: string;
}

class CycleDetected extends Data.TaggedError("CycleDetected")<{
  cycle: string[];
}> {}

export function topoSort(edges: Edge[]): string[] {
  if (edges.length === 0) {
    return [];
  }

  const program = Effect.gen(function* () {
    // Build adjacency list and in-degree map
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodes = new Set<string>();

    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);

      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);

      if (!inDegree.has(edge.to)) {
        inDegree.set(edge.to, 0);
      }
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);

      if (!inDegree.has(edge.from)) {
        inDegree.set(edge.from, 0);
      }
    }

    // Kahn's algorithm
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

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycle
    if (sorted.length !== nodes.size) {
      yield* Effect.fail(
        new CycleDetected({ cycle: Array.from(nodes).slice(0, 3) })
      );
    }

    return sorted;
  });

  try {
    return Effect.runSync(program);
  } catch (e) {
    if (e instanceof Error && e.message.includes("CycleDetected")) {
      throw new Error("Cycle detected in graph");
    }
    throw e;
  }
}

export function hasCycle(edges: Edge[]): boolean {
  if (edges.length === 0) {
    return false;
  }

  const program = Effect.gen(function* () {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodes = new Set<string>();

    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);

      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);

      if (!inDegree.has(edge.to)) {
        inDegree.set(edge.to, 0);
      }
      inDegree.set(edge.to, inDegree.get(edge.to)! + 1);

      if (!inDegree.has(edge.from)) {
        inDegree.set(edge.from, 0);
      }
    }

    const queue: string[] = [];
    for (const node of nodes) {
      if (inDegree.get(node) === 0) {
        queue.push(node);
      }
    }

    let count = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      count++;

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return count !== nodes.size;
  });

  try {
    return Effect.runSync(program);
  } catch {
    return true;
  }
}