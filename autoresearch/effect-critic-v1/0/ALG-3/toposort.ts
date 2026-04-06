import { Effect } from "effect";

function toposortInternal(
  edges: Array<[string, string]>
): Effect.Effect<{ sorted: string[]; hasCycle: boolean }, never> {
  return Effect.sync(() => {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodes = new Set<string>();
    const edgeSet = new Set<string>();

    // Build graph with deduplication
    for (const [u, v] of edges) {
      const edgeKey = `${u}|${v}`;
      if (edgeSet.has(edgeKey)) {
        continue; // Skip duplicate edge
      }
      edgeSet.add(edgeKey);

      nodes.add(u);
      nodes.add(v);

      if (!adj.has(u)) {
        adj.set(u, []);
      }
      adj.get(u)!.push(v);

      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    }

    // Initialize in-degree for all nodes
    for (const node of nodes) {
      if (!inDegree.has(node)) {
        inDegree.set(node, 0);
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

      for (const neighbor of adj.get(node) || []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    const hasCycle = sorted.length !== nodes.size;
    return { sorted, hasCycle };
  });
}

export function toposort(
  edges: Array<[string, string]>
): { sorted: string[]; hasCycle: boolean } {
  if (!Array.isArray(edges)) {
    throw new TypeError("edges must be an array");
  }

  return Effect.runSync(toposortInternal(edges));
}