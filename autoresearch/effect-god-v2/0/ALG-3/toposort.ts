import { Effect, Data, Cause, Exit } from "effect";

// ─── Exported Error ───────────────────────────────────────────────────────────

export class CycleError extends Error {
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

// ─── Internal Tagged Error ────────────────────────────────────────────────────

class InternalCycleError extends Data.TaggedError("InternalCycleError")<{
  cycle: string[];
}> {}

// ─── Internal Implementation (Effect-based) ──────────────────────────────────

/**
 * Kahn's algorithm (BFS) for topological sort.
 * Invariants:
 *   1. Every node in `nodes` appears exactly once in the output (permutation completeness).
 *   2. For every edge u→v, u appears before v in the result (ordering invariant).
 *   3. If the graph contains a cycle, InternalCycleError is raised (cycle detection).
 */
function toposortEffect<T>(
  nodes: T[],
  edges: Array<[T, T]>
): Effect.Effect<T[], InternalCycleError> {
  return Effect.gen(function* () {
    // Build index map for stable identity comparisons
    const indexOf = new Map<T, number>();
    for (let i = 0; i < nodes.length; i++) {
      indexOf.set(nodes[i], i);
    }

    // Build adjacency list and in-degree table
    const adj: number[][] = Array.from({ length: nodes.length }, () => []);
    const inDegree: number[] = new Array(nodes.length).fill(0);

    for (const [u, v] of edges) {
      const ui = indexOf.get(u);
      const vi = indexOf.get(v);
      // Skip edges whose endpoints are not in the node list
      if (ui === undefined || vi === undefined) continue;
      adj[ui].push(vi);
      inDegree[vi]++;
    }

    // Kahn's BFS
    const queue: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (inDegree[i] === 0) queue.push(i);
    }

    const sorted: T[] = [];
    // Track visited for cycle path reconstruction
    const visited = new Set<number>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      visited.add(curr);
      sorted.push(nodes[curr]);

      for (const next of adj[curr]) {
        inDegree[next]--;
        if (inDegree[next] === 0) {
          queue.push(next);
        }
      }
    }

    // If not all nodes were visited, there is a cycle
    if (sorted.length !== nodes.length) {
      // Find a node still in a cycle (in-degree > 0 after Kahn's)
      const remaining = nodes
        .map((_, i) => i)
        .filter((i) => !visited.has(i));

      // DFS to find the actual cycle path
      const cycle = findCycle(adj, remaining, nodes);

      yield* Effect.fail(new InternalCycleError({ cycle }));
    }

    return sorted;
  });
}

/** DFS cycle finder — returns node labels forming the cycle. */
function findCycle<T>(
  adj: number[][],
  candidates: number[],
  nodes: T[]
): string[] {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Array(nodes.length).fill(WHITE);
  const parent = new Array(nodes.length).fill(-1);

  let cycleStart = -1;
  let cycleEnd = -1;

  function dfs(v: number): boolean {
    color[v] = GRAY;
    for (const w of adj[v]) {
      if (color[w] === GRAY) {
        cycleStart = w;
        cycleEnd = v;
        return true;
      }
      if (color[w] === WHITE) {
        parent[w] = v;
        if (dfs(w)) return true;
      }
    }
    color[v] = BLACK;
    return false;
  }

  for (const start of candidates) {
    if (color[start] === WHITE) {
      if (dfs(start)) break;
    }
  }

  if (cycleStart === -1) {
    // Fallback: just return the candidate labels
    return candidates.map((i) => String(nodes[i]));
  }

  // Reconstruct cycle from cycleEnd back to cycleStart via parent pointers
  const path: string[] = [];
  let cur = cycleEnd;
  while (cur !== cycleStart) {
    path.push(String(nodes[cur]));
    cur = parent[cur];
    if (cur === -1) break; // safety
  }
  path.push(String(nodes[cycleStart]));
  path.reverse();
  path.push(String(nodes[cycleStart])); // close the cycle
  return path;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Topologically sorts `nodes` respecting directed edges `[u, v]` (u → v).
 *
 * @param nodes  - All nodes in the graph (determines output order for ties).
 * @param edges  - Directed edges as `[from, to]` pairs.
 * @returns      Sorted array where every u→v edge has u before v.
 * @throws       {@link CycleError} if the graph contains a cycle.
 */
export function toposort<T>(nodes: T[], edges: Array<[T, T]>): T[] {
  if (nodes.length === 0) return [];

  const exit = Effect.runSyncExit(toposortEffect(nodes, edges));

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const raw = Cause.squash(exit.cause);

  if (
    raw instanceof InternalCycleError ||
    (raw && (raw as { _tag?: string })._tag === "InternalCycleError")
  ) {
    throw new CycleError((raw as InternalCycleError).cycle);
  }

  if (raw instanceof Error) throw raw;
  throw new Error(String(raw));
}

/**
 * Convenience overload: accepts an adjacency-list graph object.
 *
 * @param graph  - `{ [node]: neighbours[] }` where each key is a node and the
 *                 value is the list of nodes it points to.
 * @returns      Topologically sorted node labels.
 * @throws       {@link CycleError} if the graph contains a cycle.
 */
export function toposortGraph(graph: Record<string, string[]>): string[] {
  const nodes = Object.keys(graph);
  const edges: Array<[string, string]> = [];
  for (const u of nodes) {
    for (const v of graph[u]) {
      edges.push([u, v]);
    }
  }
  // Include any nodes referenced only as targets
  const referenced = new Set(nodes);
  for (const [, v] of edges) {
    if (!referenced.has(v)) {
      referenced.add(v);
      nodes.push(v);
    }
  }
  return toposort(nodes, edges);
}

/**
 * Returns `true` when the directed graph described by `edges` contains a cycle.
 */
export function hasCycle<T>(nodes: T[], edges: Array<[T, T]>): boolean {
  try {
    toposort(nodes, edges);
    return false;
  } catch (e) {
    if (e instanceof CycleError) return true;
    throw e;
  }
}