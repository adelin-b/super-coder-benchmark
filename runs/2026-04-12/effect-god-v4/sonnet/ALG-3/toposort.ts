import { Effect, Exit, Cause } from "effect";

// ── Error ────────────────────────────────────────────────────────────────────

export class CycleError extends Error {
  public readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Cycle detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
    Object.setPrototypeOf(this, CycleError.prototype);
  }
}

// ── Internal Effect implementation ───────────────────────────────────────────

const toposortInternal = (
  nodes: string[],
  edges: [string, string][]
): Effect.Effect<string[], CycleError> =>
  Effect.gen(function* () {
    // Build adjacency list and in-degree map
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const n of nodes) {
      inDegree.set(n, 0);
      adj.set(n, []);
    }

    for (const [u, v] of edges) {
      if (!inDegree.has(u)) { inDegree.set(u, 0); adj.set(u, []); }
      if (!inDegree.has(v)) { inDegree.set(v, 0); adj.set(v, []); }
      adj.get(u)!.push(v);
      inDegree.set(v, inDegree.get(v)! + 1);
    }

    // Kahn's algorithm
    const allNodes = Array.from(inDegree.keys());
    const queue: string[] = allNodes.filter((n) => inDegree.get(n) === 0);
    const result: string[] = [];

    while (queue.length > 0) {
      // Sort queue for deterministic output among nodes with same in-degree
      queue.sort();
      const u = queue.shift()!;
      result.push(u);

      for (const v of adj.get(u) ?? []) {
        const deg = inDegree.get(v)! - 1;
        inDegree.set(v, deg);
        if (deg === 0) queue.push(v);
      }
    }

    if (result.length !== allNodes.length) {
      // Cycle exists — find it via DFS
      const visited = new Set<string>();
      const stack = new Set<string>();
      const cycleNodes: string[] = [];

      const dfs = (node: string): boolean => {
        visited.add(node);
        stack.add(node);
        for (const neighbor of adj.get(node) ?? []) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (stack.has(neighbor)) {
            // Reconstruct cycle path
            const stackArr = Array.from(stack);
            const idx = stackArr.indexOf(neighbor);
            cycleNodes.push(...stackArr.slice(idx), neighbor);
            return true;
          }
        }
        stack.delete(node);
        return false;
      };

      for (const n of allNodes) {
        if (!visited.has(n)) {
          if (dfs(n)) break;
        }
      }

      return yield* Effect.fail(new CycleError(cycleNodes));
    }

    return result;
  });

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Topologically sort `nodes` given directed `edges` ([u, v] means u → v).
 *
 * @throws {CycleError} if the graph contains a cycle.
 */
export function toposort(
  nodes: string[],
  edges: [string, string][]
): string[] {
  const exit = Effect.runSyncExit(toposortInternal(nodes, edges));
  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    if (raw instanceof CycleError) throw raw;
    throw new CycleError([]);
  }
  return exit.value;
}

/**
 * Like `toposort` but returns `null` instead of throwing on a cycle.
 */
export function toposortSafe(
  nodes: string[],
  edges: [string, string][]
): string[] | null {
  try {
    return toposort(nodes, edges);
  } catch (e) {
    if (e instanceof CycleError) return null;
    throw e;
  }
}

/**
 * Returns true if the directed graph defined by `edges` is acyclic (a DAG).
 */
export function isDAG(
  nodes: string[],
  edges: [string, string][]
): boolean {
  return toposortSafe(nodes, edges) !== null;
}