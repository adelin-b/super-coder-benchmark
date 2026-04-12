import { Effect, Data, Exit, Cause } from "effect";

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

class ConversionError extends Data.TaggedError("ConversionError")<{
  reason: string;
}> {}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createConverter(
  initialRates: Rate[],
  maxAgeMs?: number
): {
  convert(amount: number, from: string, to: string): ConversionResult;
  addRate(rate: Rate): void;
} {
  // from -> to -> { rate, timestamp }
  const graph = new Map<string, Map<string, { rate: number; timestamp: number }>>();

  function upsertEdge(
    from: string,
    to: string,
    rate: number,
    timestamp: number
  ): void {
    if (!graph.has(from)) graph.set(from, new Map());
    graph.get(from)!.set(to, { rate, timestamp });
  }

  function loadRate(r: Rate): void {
    if (r.rate <= 0) throw new Error("Rate must be positive");
    upsertEdge(r.from, r.to, r.rate, r.timestamp);
    upsertEdge(r.to, r.from, 1 / r.rate, r.timestamp);
  }

  function isStale(timestamp: number): boolean {
    if (maxAgeMs === undefined) return false;
    return Date.now() - timestamp > maxAgeMs;
  }

  for (const r of initialRates) {
    loadRate(r);
  }

  const convertEffect = (
    amount: number,
    from: string,
    to: string
  ): Effect.Effect<ConversionResult, ConversionError> =>
    Effect.gen(function* () {
      // Same currency short-circuit
      if (from === to) {
        return { amount: round2(amount), rate: 1, path: [from] };
      }

      // BFS over valid (non-stale) edges
      type Node = { currency: string; path: string[]; compositeRate: number };
      const queue: Node[] = [{ currency: from, path: [from], compositeRate: 1 }];
      const visited = new Set<string>();
      visited.add(from);

      while (queue.length > 0) {
        const { currency, path, compositeRate } = queue.shift()!;
        const edges = graph.get(currency);
        if (!edges) continue;

        for (const [next, { rate, timestamp }] of edges.entries()) {
          if (visited.has(next)) continue;
          if (isStale(timestamp)) continue;

          const newCompositeRate = compositeRate * rate;
          const newPath = [...path, next];

          if (next === to) {
            return {
              amount: round2(amount * newCompositeRate),
              rate: newCompositeRate,
              path: newPath,
            };
          }

          visited.add(next);
          queue.push({ currency: next, path: newPath, compositeRate: newCompositeRate });
        }
      }

      yield* Effect.fail(
        new ConversionError({
          reason: `No valid conversion path from ${from} to ${to}`,
        })
      );

      // Unreachable — satisfies TypeScript
      return { amount: 0, rate: 0, path: [] };
    });

  return {
    convert(amount: number, from: string, to: string): ConversionResult {
      if (!Number.isFinite(amount)) throw new Error("Amount must be a finite number");

      const exit = Effect.runSyncExit(convertEffect(amount, from, to));

      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause);
        if (err instanceof Error) throw err;
        throw new Error(String(err));
      }

      return exit.value;
    },

    addRate(rate: Rate): void {
      loadRate(rate);
    },
  };
}