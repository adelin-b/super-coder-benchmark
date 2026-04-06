export type Graph<T> = Map<T, T[]>;
export type Edge<T> = [T, T];

export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

/**
 * Topologically sorts a DAG using DFS.
 * @param graph - Adjacency list representation (Map of node -> neighbors)
 * @returns Array of nodes in topological order
 * @throws CycleDetectedError if a cycle is detected
 */
export function toposort<T>(graph: Graph<T>): T[] {
  const visited = new Set<T>();
  const recursionStack = new Set<T>();
  const sorted: T[] = [];

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, graph, visited, recursionStack, sorted);
    }
  }

  return sorted.reverse();
}

/**
 * Topologically sorts a DAG from an edge list.
 * @param edges - Array of [from, to] edges
 * @returns Array of nodes in topological order
 * @throws CycleDetectedError if a cycle is detected
 */
export function toposortFromEdges<T>(edges: Edge<T>[]): T[] {
  const graph = new Map<T, T[]>();
  const nodes = new Set<T>();

  for (const [from, to] of edges) {
    if (!graph.has(from)) {
      graph.set(from, []);
    }
    graph.get(from)!.push(to);
    nodes.add(from);
    nodes.add(to);
  }

  for (const node of nodes) {
    if (!graph.has(node)) {
      graph.set(node, []);
    }
  }

  return toposort(graph);
}

function dfs<T>(
  node: T,
  graph: Graph<T>,
  visited: Set<T>,
  recursionStack: Set<T>,
  sorted: T[]
): void {
  visited.add(node);
  recursionStack.add(node);

  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      dfs(neighbor, graph, visited, recursionStack, sorted);
    } else if (recursionStack.has(neighbor)) {
      throw new CycleDetectedError(
        `Cycle detected: node ${String(neighbor)} reached during recursion`
      );
    }
  }

  recursionStack.delete(node);
  sorted.push(node);
}