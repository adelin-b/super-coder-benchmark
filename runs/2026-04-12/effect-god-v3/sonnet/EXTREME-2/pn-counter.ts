import { Effect, Data } from "effect";

// ── Internal tagged errors ────────────────────────────────────────────────────

class InvalidId extends Data.TaggedError("InvalidId")<{ reason: string }> {}
class InvalidAmount extends Data.TaggedError("InvalidAmount")<{ reason: string }> {}

// ── Public exports ────────────────────────────────────────────────────────────

export interface ReplicaState {
  id: string;
  positive: Record<string, number>;
  negative: Record<string, number>;
  clock: Record<string, number>;
}

export function createReplica(id: string): {
  increment(amount?: number): void;
  decrement(amount?: number): void;
  value(): number;
  merge(other: ReplicaState): void;
  state(): ReplicaState;
  happensBefore(other: ReplicaState): boolean;
  concurrent(other: ReplicaState): boolean;
  reset(): void;
} {
  // Validate id
  if (!id || id.trim() === "") {
    throw new Error("Replica id must be non-empty");
  }

  // Internal mutable state
  let positive: Record<string, number> = {};
  let negative: Record<string, number> = {};
  let clock: Record<string, number> = { [id]: 0 };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function sumMap(m: Record<string, number>): number {
    return Object.values(m).reduce((acc, v) => acc + v, 0);
  }

  function deepCopyState(): ReplicaState {
    return {
      id,
      positive: { ...positive },
      negative: { ...negative },
      clock: { ...clock },
    };
  }

  // ── Effect-based operations ──────────────────────────────────────────────────

  const incrementEffect = (amount: number): Effect.Effect<void, InvalidAmount> =>
    Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ reason: "amount must be > 0" }));
      }
      positive[id] = (positive[id] ?? 0) + amount;
      clock[id] = (clock[id] ?? 0) + 1;
    });

  const decrementEffect = (amount: number): Effect.Effect<void, InvalidAmount> =>
    Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ reason: "amount must be > 0" }));
      }
      negative[id] = (negative[id] ?? 0) + amount;
      clock[id] = (clock[id] ?? 0) + 1;
    });

  const mergeEffect = (other: ReplicaState): Effect.Effect<void, never> =>
    Effect.sync(() => {
      // Merge positive: element-wise max
      const allPosKeys = new Set([...Object.keys(positive), ...Object.keys(other.positive)]);
      for (const k of allPosKeys) {
        positive[k] = Math.max(positive[k] ?? 0, other.positive[k] ?? 0);
      }
      // Merge negative: element-wise max
      const allNegKeys = new Set([...Object.keys(negative), ...Object.keys(other.negative)]);
      for (const k of allNegKeys) {
        negative[k] = Math.max(negative[k] ?? 0, other.negative[k] ?? 0);
      }
      // Merge vector clocks: element-wise max
      const allClockKeys = new Set([...Object.keys(clock), ...Object.keys(other.clock)]);
      for (const k of allClockKeys) {
        clock[k] = Math.max(clock[k] ?? 0, other.clock[k] ?? 0);
      }
      // Merge is a local event — increment own clock
      clock[id] = (clock[id] ?? 0) + 1;
    });

  const resetEffect = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      positive[id] = 0;
      negative[id] = 0;
      clock[id] = (clock[id] ?? 0) + 1;
    });

  // ── Happens-before logic ─────────────────────────────────────────────────────

  function happensBefore(thisClock: Record<string, number>, otherClock: Record<string, number>): boolean {
    // For all IDs in thisClock: thisClock[id] <= otherClock[id]
    // AND at least one strict inequality
    // IDs absent from a clock are treated as 0
    let strictLess = false;

    for (const k of Object.keys(thisClock)) {
      const aVal = thisClock[k] ?? 0;
      const bVal = otherClock[k] ?? 0;
      if (aVal > bVal) {
        return false; // violates happens-before
      }
      if (aVal < bVal) {
        strictLess = true;
      }
    }

    // Also check: any ID in thisClock not in otherClock — treated as 0 in other
    // Already handled above since otherClock[k] ?? 0 = 0 if absent
    // If thisClock[k] > 0 and otherClock[k] is absent (0), we'd return false above

    return strictLess;
  }

  function isConcurrent(
    thisClock: Record<string, number>,
    otherClock: Record<string, number>
  ): boolean {
    // Check for true incomparability: exists i where this[i] > other[i] AND exists j where other[j] > this[j]
    let thisAhead = false;
    let otherAhead = false;

    const allKeys = new Set([...Object.keys(thisClock), ...Object.keys(otherClock)]);
    for (const k of allKeys) {
      const aVal = thisClock[k] ?? 0;
      const bVal = otherClock[k] ?? 0;
      if (aVal > bVal) thisAhead = true;
      if (bVal > aVal) otherAhead = true;
    }

    return thisAhead && otherAhead;
  }

  // ── Run helpers ──────────────────────────────────────────────────────────────

  function runSync<A, E extends { message: string }>(eff: Effect.Effect<A, E>): A {
    const { Exit, Cause } = require("effect") as typeof import("effect");
    const exit = Effect.runSyncExit(eff);
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
      throw new Error(msg);
    }
    return exit.value;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    increment(amount: number = 1): void {
      runSync(incrementEffect(amount));
    },

    decrement(amount: number = 1): void {
      runSync(decrementEffect(amount));
    },

    value(): number {
      return sumMap(positive) - sumMap(negative);
    },

    merge(other: ReplicaState): void {
      runSync(mergeEffect(other));
    },

    state(): ReplicaState {
      return deepCopyState();
    },

    happensBefore(other: ReplicaState): boolean {
      return happensBefore(clock, other.clock);
    },

    concurrent(other: ReplicaState): boolean {
      return isConcurrent(clock, other.clock);
    },

    reset(): void {
      runSync(resetEffect());
    },
  };
}