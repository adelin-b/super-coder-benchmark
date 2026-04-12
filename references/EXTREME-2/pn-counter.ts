export interface ReplicaState {
  id: string;
  positive: Record<string, number>;
  negative: Record<string, number>;
  clock: Record<string, number>;
}

export function createReplica(id: string) {
  if (!id || typeof id !== 'string') throw new Error('Replica id must be non-empty');

  let positive: Record<string, number> = {};
  let negative: Record<string, number> = {};
  let clock: Record<string, number> = { [id]: 0 };

  return {
    increment(amount: number = 1): void {
      if (amount <= 0) throw new Error('amount must be > 0');
      positive[id] = (positive[id] ?? 0) + amount;
      clock[id] = (clock[id] ?? 0) + 1;
    },

    decrement(amount: number = 1): void {
      if (amount <= 0) throw new Error('amount must be > 0');
      negative[id] = (negative[id] ?? 0) + amount;
      clock[id] = (clock[id] ?? 0) + 1;
    },

    value(): number {
      let pos = 0;
      for (const v of Object.values(positive)) pos += v;
      let neg = 0;
      for (const v of Object.values(negative)) neg += v;
      return pos - neg;
    },

    merge(other: ReplicaState): void {
      // Element-wise MAX for positive map
      const allPosKeys = new Set([...Object.keys(positive), ...Object.keys(other.positive)]);
      for (const k of allPosKeys) {
        positive[k] = Math.max(positive[k] ?? 0, other.positive[k] ?? 0);
      }

      // Element-wise MAX for negative map
      const allNegKeys = new Set([...Object.keys(negative), ...Object.keys(other.negative)]);
      for (const k of allNegKeys) {
        negative[k] = Math.max(negative[k] ?? 0, other.negative[k] ?? 0);
      }

      // Element-wise MAX for vector clock, then increment own
      const allClockKeys = new Set([...Object.keys(clock), ...Object.keys(other.clock)]);
      for (const k of allClockKeys) {
        clock[k] = Math.max(clock[k] ?? 0, other.clock[k] ?? 0);
      }
      clock[id] = (clock[id] ?? 0) + 1;
    },

    state(): ReplicaState {
      return {
        id,
        positive: { ...positive },
        negative: { ...negative },
        clock: { ...clock },
      };
    },

    happensBefore(other: ReplicaState): boolean {
      const localClock = clock;
      const remoteClock = other.clock;

      // Gather all keys from both clocks
      const allKeys = new Set([...Object.keys(localClock), ...Object.keys(remoteClock)]);

      let hasStrictlyLess = false;

      for (const k of allKeys) {
        const localVal = localClock[k] ?? 0;
        const remoteVal = remoteClock[k] ?? 0;

        if (localVal > remoteVal) {
          return false; // local has a component > remote, can't be happens-before
        }
        if (localVal < remoteVal) {
          hasStrictlyLess = true;
        }
      }

      return hasStrictlyLess;
    },

    concurrent(other: ReplicaState): boolean {
      const localClock = clock;
      const remoteClock = other.clock;

      const allKeys = new Set([...Object.keys(localClock), ...Object.keys(remoteClock)]);

      let localHasGreater = false;
      let remoteHasGreater = false;

      for (const k of allKeys) {
        const localVal = localClock[k] ?? 0;
        const remoteVal = remoteClock[k] ?? 0;

        if (localVal > remoteVal) localHasGreater = true;
        if (remoteVal > localVal) remoteHasGreater = true;
      }

      // Concurrent = incomparable: both have at least one component greater
      return localHasGreater && remoteHasGreater;
    },

    reset(): void {
      positive[id] = 0;
      negative[id] = 0;
      clock[id] = (clock[id] ?? 0) + 1;
    },
  };
}
