import { Effect, Data, Exit, Cause } from "effect";

// ── Public interfaces ────────────────────────────────────────────────────────

export interface Rate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

export interface ConversionResult {
  amount: number;
  rate: number;
  path: string[];
}

export class ConverterError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ConverterError";
    Object.setPrototypeOf(this, ConverterError.prototype);
  }
}

// ── Internal tagged errors ───────────────────────────────────────────────────

class NoPathError extends Data.TaggedError("NoPathError")<{
  from: string;
  to: string;
}> {}

class StaleRateError extends Data.TaggedError("StaleRateError")<{
  from: string;
  to: string;
}> {}

// ── Graph types ──────────────────────────────────────────────────────────────

type EdgeMap = Map<string, { rate: number; timestamp: number }>;
type Graph = Map<string, EdgeMap>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGraph(rates: Rate[]): Graph {
  const graph: Graph = new Map();

  const ensure = (currency: string): EdgeMap => {
    if (!graph.has(currency)) graph.set(currency, new Map());
    return graph.get(currency)!;
  };

  for (const r of rates) {
    if (r.rate <= 0 || !isFinite(r.rate)) continue;

    const fromEdges = ensure(r.from);
    const toEdges = ensure(r.to);

    // Direct edge — keep most recent
    const existing = fromEdges.get(r.to);
    if (!existing || r.timestamp > existing.timestamp) {
      fromEdges.set(r.to, { rate: r.rate, timestamp: r.timestamp });
    }

    // Inverse edge — keep most recent
    const existingInv = toEdges.get(r.from);
    if (!existingInv || r.timestamp > existingInv.timestamp) {
      toEdges.set(r.from, { rate: 1 / r.rate, timestamp: r.timestamp });
    }
  }

  return graph;
}

interface PathResult {
  path: string[];
  rate: number;
}

function bfsPath(from: string, to: string, graph: Graph): PathResult | null {
  if (from === to) return { path: [from], rate: 1 };

  type State = { currency: string; path: string[]; rate: number };
  const queue: State[] = [{ currency: from, path: [from], rate: 1 }];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const { currency, path, rate } = queue.shift()!;
    const edges = graph.get(currency);
    if (!edges) continue;

    for (const [next, edge] of edges) {
      if (visited.has(next)) continue;
      const newRate = rate * edge.rate;
      const newPath = [...path, next];

      if (next === to) return { path: newPath, rate: newRate };

      visited.add(next);
      queue.push({ currency: next, path: newPath, rate: newRate });
    }
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Internal Effect logic ────────────────────────────────────────────────────

function makeConvertEffect(
  rateStore: Rate[],
  maxAgeMs: number | undefined,
  amount: number,
  from: string,
  to: string
): Effect.Effect<ConversionResult, NoPathError | StaleRateError> {
  return Effect.gen(function* () {
    if (from === to) {
      return { amount: round2(amount), rate: 1, path: [from] };
    }

    const now = Date.now();

    const isStale = (r: Rate) =>
      maxAgeMs !== undefined && now - r.timestamp > maxAgeMs;

    const freshRates = rateStore.filter((r) => !isStale(r));
    const freshGraph = buildGraph(freshRates);
    const freshResult = bfsPath(from, to, freshGraph);

    if (freshResult) {
      return {
        amount: round2(amount * freshResult.rate),
        rate: freshResult.rate,
        path: freshResult.path,
      };
    }

    // Check whether stale rates would have provided a path
    if (maxAgeMs !== undefined) {
      const allGraph = buildGraph(rateStore);
      const staleResult = bfsPath(from, to, allGraph);
      if (staleResult) {
        yield* Effect.fail(new StaleRateError({ from, to }));
      }
    }

    yield* Effect.fail(new NoPathError({ from, to }));
    // unreachable — satisfies TypeScript
    return { amount: 0, rate: 0, path: [] };
  });
}

// ── Public factory ───────────────────────────────────────────────────────────

export function createConverter(
  rates: Rate[],
  maxAgeMs?: number
): {
  convert(amount: number, from: string, to: string): ConversionResult;
  addRate(rate: Rate): void;
} {
  const rateStore: Rate[] = [...rates];

  return {
    convert(amount: number, from: string, to: string): ConversionResult {
      const program = makeConvertEffect(rateStore, maxAgeMs, amount, from, to);
      const exit = Effect.runSyncExit(program);

      if (Exit.isFailure(exit)) {
        const raw = Cause.squash(exit.cause) as unknown;

        let msg: string;
        if (
          raw &&
          typeof raw === "object" &&
          "_tag" in raw &&
          (raw as { _tag: string })._tag === "StaleRateError"
        ) {
          const e = raw as StaleRateError;
          msg = `Rate from ${e.from} to ${e.to} is stale`;
        } else if (
          raw &&
          typeof raw === "object" &&
          "_tag" in raw &&
          (raw as { _tag: string })._tag === "NoPathError"
        ) {
          const e = raw as NoPathError;
          msg = `No conversion path from ${e.from} to ${e.to}`;
        } else if (raw instanceof Error) {
          msg = raw.message;
        } else {
          msg = String(raw);
        }

        throw new ConverterError(msg);
      }

      return exit.value;
    },

    addRate(rate: Rate): void {
      rateStore.push(rate);
    },
  };
}