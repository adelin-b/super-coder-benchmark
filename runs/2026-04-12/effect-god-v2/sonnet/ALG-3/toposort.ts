import { Effect, Data } from "effect";

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class CycleError extends Error {
  readonly cycle: readonly string[];
  constructor(cycle: readonly string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeId = string | number;

export interface Graph<T extends NodeId = NodeId> {
  /** All nodes in the graph (including isolated ones) */
  nodes: T[];
  /** Directed edges: [from, to] meaning from → to */
  edges: [T, T][];
}

// ─── Internal Effect Implementation ──────────────────────────────────────────

class InternalCycle extends Data.TaggedError("InternalCycle")<{
  cycle: readonly string[];
}> {}

/**
 * Kahn's algorithm: repeatedly peel nodes with in-degree 0.
 * If any nodes remain unprocessed → cycle exists.
 */
const kahnSort = <T extends NodeId>(
  graph: Graph<T>
): Effect.Effect<T[], InternalCycle> =>
  Effect.gen(function* () {
    const nodeSet = new Set<T>(graph.nodes);

    // Collect all nodes referenced in edges too
    for (const [u, v] of graph.edges) {
      nodeSet.add(u);
      nodeSet.add(v);
    }

    const allNodes = Array.from(nodeSet);

    // Build adjacency list and in-degree map
    const adj = new Map<T, T[]>();
    const inDegree = new Map<T, number>();

    for (const n of allNodes) {
      adj.set(n, []);
      inDegree.set(n, 0);
    }

    for (const [u, v] of graph.edges) {
      adj.get(u)!.push(v);
      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    }

    // Initialize queue with zero in-degree nodes (stable: sort for determinism)
    const queue: T[] = allNodes
      .filter((n) => inDegree.get(n) === 0)
      .sort((a, b) => String(a).localeCompare(String(b)));

    const result: T[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = adj.get(node) ?? [];
      // Sort neighbors for deterministic output
      const sorted = [...neighbors].sort((a, b) =>
        String(a).localeCompare(String(b))
      );

      for (const neighbor of sorted) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          // Insert in sorted position for determinism
          const insertAt = queue.findIndex(
            (q) => String(q).localeCompare(String(neighbor)) > 0
          );
          if (insertAt === -1) {
            queue.push(neighbor);
          } else {
            queue.splice(insertAt, 0, neighbor);
          }
        }
      }
    }

    if (result.length !== allNodes.length) {
      // Cycle exists — find it via DFS
      const cycle = findCycle(allNodes, adj);
      yield* Effect.fail(new InternalCycle({ cycle }));
    }

    return result;
  });

/** DFS-based cycle finder — returns cycle as string labels */
function findCycle<T extends NodeId>(
  allNodes: T[],
  adj: Map<T, T[]>
): readonly string[] {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<T, number>();
  for (const n of allNodes) color.set(n, WHITE);

  const path: T[] = [];

  const dfs = (node: T): T[] | null => {
    color.set(node, GRAY);
    path.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        // Found cycle — extract it from path
        const idx = path.indexOf(neighbor);
        return [...path.slice(idx), neighbor];
      }
      if (color.get(neighbor) === WHITE) {
        const result = dfs(neighbor);
        if (result) return result;
      }
    }
    path.pop();
    color.set(node, BLACK);
    return null;
  };

  for (const node of allNodes) {
    if (color.get(node) === WHITE) {
      const cycle = dfs(node);
      if (cycle) return cycle.map(String);
    }
  }

  return ["<unknown cycle>"];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sort nodes of a DAG topologically.
 * Every edge u → v guarantees u appears before v in the output.
 *
 * @throws {CycleError} if the graph contains a cycle
 */
export function topoSort<T extends NodeId>(graph: Graph<T>): T[] {
  if (graph.nodes.length === 0 && graph.edges.length === 0) return [];

  const exit = Effect.runSyncExit(kahnSort(graph));

  if (exit._tag === "Failure") {
    const { Cause } = require("effect") as typeof import("effect");
    const err = Cause.squash(exit.cause);
    if (err instanceof InternalCycle) {
      throw new CycleError(err.cycle);
    }
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }

  return exit.value;
}

/**
 * Convenience overload: build a Graph from a plain adjacency list object.
 * Keys are node IDs, values are arrays of successor node IDs.
 *
 * @throws {CycleError} if the graph contains a cycle
 */
export function topoSortAdjacency(
  adjacency: Record<string, string[]>
): string[] {
  const nodes = Object.keys(adjacency);
  const edges: [string, string][] = [];
  for (const [from, tos] of Object.entries(adjacency)) {
    for (const to of tos) {
      edges.push([from, to]);
    }
  }
  return topoSort({ nodes, edges });
}

/**
 * Returns true if the given graph is acyclic (a valid DAG), false otherwise.
 */
export function isAcyclic<T extends NodeId>(graph: Graph<T>): boolean {
  try {
    topoSort(graph);
    return true;
  } catch (e) {
    if (e instanceof CycleError) return false;
    throw e;
  }
}