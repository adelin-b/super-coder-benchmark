export function toposort<T extends string | number>(
  nodes: T[],
  edges: [T, T][]
): T[] {
  if (nodes.length === 0) {
    return [];
  }

  const nodeSet = new Set(nodes);
  for (const [from, to] of edges) {
    if (!nodeSet.has(from) || !nodeSet.has(to)) {
      throw new Error("Invalid edge: node not in nodes list");
    }
  }

  const inDegree = new Map<T, number>();
  const adjList = new Map<T, T[]>();

  for (const node of nodes) {
    inDegree.set(node, 0);
    adjList.set(node, []);
  }

  for (const [from, to] of edges) {
    adjList.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  const queue: T[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const sorted: T[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjList.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Cycle detected in graph");
  }

  return sorted;
}