import { Effect, Data } from "effect";
import { Exit, Cause } from "effect";

// ─── Public Error ────────────────────────────────────────────────────────────

export class CycleError extends Error {
  public readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
    Object.setPrototypeOf(this, CycleError.prototype);
  }
}

// ─── Internal Tagged Error ────────────────────────────────────────────────────

class InternalCycleError extends Data.TaggedError("InternalCycleError")<{
  cycle: string[];
}> {}

// ─── Internal Effect Implementation (Kahn's Algorithm) ───────────────────────

const toposortEffect = (
  nodes: string[],
  edges: [string, string][]
): Effect.Effect<string[], InternalCycleError> =>
  Effect.gen(function* () {
    const nodeSet = new Set(nodes);

    // Build adjacency list and in-degree map
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adj.set(node, []);
      inDegree.set(node, 0);
    }

    for (const [u, v] of edges) {
      if (!nodeSet.has(u) || !nodeSet.has(v)) continue;
      adj.get(u)!.push(v);
      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    }

    // Queue nodes with in-degree 0
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
        const deg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== nodes.length) {
      // Cycle exists — find it via DFS
      const cycle = findCycle(nodes, edges);
      yield* Effect.fail(new InternalCycleError({ cycle }));
    }

    return result;
  });

// ─── Cycle Detection via DFS ──────────────────────────────────────────────────

function findCycle(nodes: string[], edges: [string, string][]): string[] {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node, []);
  for (const [u, v] of edges) {
    if (adj.has(u) && adj.has(v)) adj.get(u)!.push(v);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of nodes) {
    color.set(node, WHITE);
    parent.set(node, null);
  }

  let cycleStart: string | null = null;
  let cycleEnd: string | null = null;

  const dfs = (u: string): boolean => {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        cycleStart = v;
        cycleEnd = u;
        return true;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }
    color.set(u, BLACK);
    return false;
  };

  for (const node of nodes) {
    if (color.get(node) === WHITE) {
      if (dfs(node)) break;
    }
  }

  if (cycleStart === null || cycleEnd === null) return [];

  const cycle: string[] = [];
  let cur: string | null = cycleEnd;
  while (cur !== null && cur !== cycleStart) {
    cycle.push(cur);
    cur = parent.get(cur) ?? null;
  }
  cycle.push(cycleStart);
  cycle.reverse();
  cycle.push(cycleStart);
  return cycle;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Topologically sort `nodes` given directed `edges` [u, v] meaning u → v.
 * Returns a new array where every edge u→v has u appearing before v.
 * Throws `CycleError` if the graph contains a cycle.
 */
export function toposort(nodes: string[], edges: [string, string][]): string[] {
  const exit = Effect.runSyncExit(toposortEffect(nodes, edges));

  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    if (raw instanceof InternalCycleError) {
      throw new CycleError(raw.cycle);
    }
    const msg = raw instanceof Error ? raw.message : String(raw);
    throw new CycleError([msg]);
  }

  return exit.value;
}

/**
 * Build an adjacency-list graph from a list of edges for convenience.
 */
export function buildGraph(
  edges: [string, string][]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const [u, v] of edges) {
    if (!graph.has(u)) graph.set(u, []);
    if (!graph.has(v)) graph.set(v, []);
    graph.get(u)!.push(v);
  }
  return graph;
}

/**
 * Collect all unique node names referenced in a list of edges.
 */
export function collectNodes(edges: [string, string][]): string[] {
  const set = new Set<string>();
  for (const [u, v] of edges) {
    set.add(u);
    set.add(v);
  }
  return Array.from(set);
}