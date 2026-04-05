export class CycleError extends Error {
  public readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

/** Adjacency list: maps each node to the list of nodes it points to. */
export type Graph = Record<string, string[]>;

const enum Mark {
  Unvisited,
  InProgress,
  Done,
}

function dfs(
  node: string,
  graph: Graph,
  marks: Map<string, Mark>,
  result: string[],
  path: string[]
): void {
  const mark = marks.get(node) ?? Mark.Unvisited;

  if (mark === Mark.Done) return;

  if (mark === Mark.InProgress) {
    const cycleStart = path.indexOf(node);
    throw new CycleError([...path.slice(cycleStart), node]);
  }

  marks.set(node, Mark.InProgress);
  path.push(node);

  const neighbors = graph[node] ?? [];
  for (const neighbor of neighbors) {
    dfs(neighbor, graph, marks, result, path);
  }

  path.pop();
  marks.set(node, Mark.Done);
  result.push(node);
}

/**
 * Topologically sort a directed acyclic graph (DAG).
 *
 * @param graph - Adjacency list where graph[u] = [v, ...] means u → v edges.
 * @returns Nodes in topological order (every u appears before all its successors).
 * @throws {CycleError} If the graph contains a cycle.
 */
export function toposort(graph: Graph): string[] {
  const allNodes = new Set<string>();

  for (const [node, neighbors] of Object.entries(graph)) {
    allNodes.add(node);
    for (const neighbor of neighbors) {
      allNodes.add(neighbor);
    }
  }

  const marks = new Map<string, Mark>();
  const result: string[] = [];
  const path: string[] = [];

  for (const node of allNodes) {
    if ((marks.get(node) ?? Mark.Unvisited) === Mark.Unvisited) {
      dfs(node, graph, marks, result, path);
    }
  }

  // DFS post-order gives reverse topological order
  result.reverse();
  return result;
}