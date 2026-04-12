import { Effect, Data } from "effect";

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

class InternalCycle extends Data.TaggedError("InternalCycle")<{
  cycle: string[];
}> {}

// ─── Types ───────────────────────────────────────────────────────────────────

export type Edge = [string, string];

export interface TopoResult {
  sorted: string[];
  hasCycle: boolean;
}

// ─── Internal Implementation (DFS-based) ─────────────────────────────────────

type Color = "white" | "gray" | "black";

const toposortEffect = (
  nodes: string[],
  edges: Edge[]
): Effect.Effect<string[], InternalCycle> =>
  Effect.gen(function* () {
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n, []);
    for (const [u, v] of edges) {
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u)!.push(v);
    }

    const color = new Map<string, Color>();
    const parent = new Map<string, string | null>();
    for (const n of adj.keys()) {
      color.set(n, "white");
      parent.set(n, null);
    }

    const result: string[] = [];

    // Iterative DFS to avoid stack overflow on large graphs
    const visitAll = (start: string): Effect.Effect<void, InternalCycle> =>
      Effect.gen(function* () {
        if (color.get(start) !== "white") return;

        // Stack holds [node, iterator over neighbors, parentNode]
        const stack: Array<[string, string | null, Iterator<string>]> = [];
        color.set(start, "gray");
        stack.push([start, null, adj.get(start)![Symbol.iterator]()]);

        while (stack.length > 0) {
          const frame = stack[stack.length - 1];
          const [node, , iter] = frame;
          const { value: neighbor, done } = iter.next();

          if (done) {
            color.set(node, "black");
            result.push(node);
            stack.pop();
          } else {
            const nc = color.get(neighbor) ?? "white";
            if (nc === "gray") {
              // Found a back edge — reconstruct cycle
              const cycle: string[] = [neighbor];
              for (let i = stack.length - 1; i >= 0; i--) {
                cycle.unshift(stack[i][0]);
                if (stack[i][0] === neighbor) break;
              }
              cycle.push(neighbor);
              yield* Effect.fail(new InternalCycle({ cycle }));
            } else if (nc === "white") {
              color.set(neighbor, "gray");
              parent.set(neighbor, node);
              stack.push([
                neighbor,
                node,
                adj.get(neighbor)![Symbol.iterator](),
              ]);
            }
          }
        }
      });

    for (const n of adj.keys()) {
      if (color.get(n) === "white") {
        yield* visitAll(n);
      }
    }

    return result.reverse();
  });

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Sort DAG nodes topologically so every edge u→v has u before v.
 * Throws CycleError if the graph contains a cycle.
 */
export function toposort(nodes: string[], edges: Edge[]): string[] {
  if (!Array.isArray(nodes)) throw new TypeError("nodes must be an array");
  if (!Array.isArray(edges)) throw new TypeError("edges must be an array");

  const { Exit, Cause } = require("effect") as typeof import("effect");

  const exit = Effect.runSyncExit(toposortEffect(nodes, edges));

  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    if (raw instanceof InternalCycle) {
      throw new CycleError(raw.cycle);
    }
    const msg = raw instanceof Error ? raw.message : String(raw);
    throw new CycleError([msg]);
  }

  return exit.value;
}

/**
 * Returns true if the graph contains at least one cycle, false otherwise.
 */
export function hasCycle(nodes: string[], edges: Edge[]): boolean {
  try {
    toposort(nodes, edges);
    return false;
  } catch (e) {
    if (e instanceof CycleError) return true;
    throw e;
  }
}

/**
 * Like toposort but returns a result object instead of throwing.
 * If a cycle is detected, sorted is empty and hasCycle is true.
 */
export function toposortSafe(nodes: string[], edges: Edge[]): TopoResult {
  try {
    const sorted = toposort(nodes, edges);
    return { sorted, hasCycle: false };
  } catch (e) {
    if (e instanceof CycleError) return { sorted: [], hasCycle: true };
    throw e;
  }
}