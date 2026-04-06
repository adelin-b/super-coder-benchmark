interface Graph<T> {
  nodes: T[];
  edges: Array<[T, T]>;
}

class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleError";
  }
}

function toposort<T>(graph: Graph<T>): T[] {
  // Build adjacency list and in-degree map
  const adjacencyList = new Map<T, T[]>();
  const inDegree = new Map<T, number>();

  // Initialize all nodes
  for (const node of graph.nodes) {
    adjacencyList.set(node, []);
    inDegree.set(node, 0);
  }

  // Build the graph from edges
  for (const [from, to] of graph.edges) {
    if (!adjacencyList.has(from) || !adjacencyList.has(to)) {
      throw new Error("Edge references non-existent node");
    }
    adjacencyList.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }

  // Kahn's algorithm: find all nodes with in-degree 0
  const queue: T[] = [];
  for (const node of graph.nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const sorted: T[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighbor of adjacencyList.get(node)!) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Cycle detection: if not all nodes processed, a cycle exists
  if (sorted.length !== graph.nodes.length) {
    throw new CycleError();
  }

  return sorted;
}

export { Graph, CycleError, toposort };