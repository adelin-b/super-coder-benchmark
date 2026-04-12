# EXTREME-2: Eventually-Consistent PN-Counter with Vector Clocks

## Overview
Implement a CRDT (Conflict-free Replicated Data Type) PN-Counter with vector clocks for causal ordering. The counter supports increment, decrement, merge, and reset operations with strong consistency guarantees.

## Exported API

```ts
export interface ReplicaState {
  id: string;
  positive: Record<string, number>;   // replica ID -> count
  negative: Record<string, number>;   // replica ID -> count
  clock: Record<string, number>;      // vector clock: replica ID -> logical time
}

export function createReplica(id: string): {
  /** Increment counter by amount (default 1). */
  increment(amount?: number): void;
  /** Decrement counter by amount (default 1). */
  decrement(amount?: number): void;
  /** Get current counter value: sum(positive) - sum(negative). */
  value(): number;
  /** Merge state from another replica. */
  merge(other: ReplicaState): void;
  /** Get a snapshot of the current state (deep copy). */
  state(): ReplicaState;
  /** Check if this replica's state causally happens-before the other. */
  happensBefore(other: ReplicaState): boolean;
  /** Check if this replica's state is concurrent with the other. */
  concurrent(other: ReplicaState): boolean;
  /** Reset this replica's contributions to zero. */
  reset(): void;
};
```

## Detailed Requirements

### PN-Counter Structure
- Each replica maintains two maps:
  - `positive`: maps replica IDs to their cumulative increment counts.
  - `negative`: maps replica IDs to their cumulative decrement counts.
- The counter value is `sum(all values in positive) - sum(all values in negative)`.

### Increment / Decrement
- `increment(amount)` adds `amount` to `positive[ownId]`. Default amount is 1.
- `decrement(amount)` adds `amount` to `negative[ownId]`. Default amount is 1.
- Both operations increment the replica's own entry in the vector clock by 1.
- `amount` must be > 0. Throw `Error` if amount <= 0.

### Vector Clock
- Each replica maintains a vector clock mapping replica IDs to logical timestamps.
- On local operations (increment, decrement, reset), increment `clock[ownId]` by 1.
- On merge, take element-wise MAX: `clock[id] = max(local[id], remote[id])` for all IDs present in either clock. Then increment `clock[ownId]` by 1 (the merge itself is a local event).

### Merge
- `merge(other)` takes a `ReplicaState` (snapshot from another replica).
- For the positive map: `positive[id] = max(local[id] ?? 0, remote[id] ?? 0)` for all IDs.
- For the negative map: `negative[id] = max(local[id] ?? 0, remote[id] ?? 0)` for all IDs.
- Vector clock merge as described above.

### CRDT Properties
- **Commutativity**: `merge(A, B)` produces the same value as `merge(B, A)`.
- **Idempotency**: `merge(A, A)` produces the same value as `A` alone.
- **Associativity**: `merge(merge(A, B), C)` produces the same value as `merge(A, merge(B, C))`.

### Happens-Before (Causal Ordering)
- State A happens-before State B (`A < B`) if and only if:
  - For ALL replica IDs present in A's clock: `A.clock[id] <= B.clock[id]`
  - AND there exists at least one replica ID where `A.clock[id] < B.clock[id]`
  - AND for any replica ID present in A's clock but not in B's clock, A's value must be 0.
- If a replica ID is absent from a clock, treat it as 0.

### Concurrent
- Two states are concurrent if neither happens-before the other.
- `concurrent(other)` returns true if `!this.happensBefore(other) && !other.happensBefore(this)` where `this` is the current replica state and `other` is the provided state.
- Note: identical states are NOT concurrent (they are equal, and neither happens-before the other, but `happensBefore` returns false for equal states, so `concurrent` would return true). However, truly equal states should return `false` for `concurrent`. Two states are concurrent only if they are INCOMPARABLE: there exist components where A > B AND components where B > A.

### Reset
- `reset()` sets `positive[ownId]` and `negative[ownId]` to 0.
- Increments `clock[ownId]` by 1.
- Does NOT modify entries for other replicas.
- After a merge, if the remote state has `positive[resetReplicaId]` or `negative[resetReplicaId]` values that are GREATER than the local values (which are 0 after reset), the merge will restore them (max semantics). This means:
  - A reset only "wins" against values that were set BEFORE the reset (causally prior).
  - If another replica incremented concurrently with (or after) the reset, those increments survive the merge because they will have higher values.

### State Snapshots
- `state()` returns a deep copy of the current replica state.
- Modifying the returned object must not affect the replica's internal state.

### Validation
- Replica `id` must be non-empty. Throw `Error` if empty.
- `amount` in increment/decrement must be > 0. Throw `Error` otherwise.

### Edge Cases
- A newly created replica has value 0, empty maps, and clock `{ownId: 0}`.
- Merging with self (own state) is idempotent.
- Multiple resets followed by increments accumulate correctly.
- Merging states from replicas that have never communicated works correctly (concurrent states).

## Invariants
1. `value()` always equals `sum(positive values) - sum(negative values)`.
2. Values in positive and negative maps are always >= 0.
3. Vector clock entries are always >= 0.
4. `state()` returns a deep copy (mutations don't affect internal state).
5. After `merge(other)`, the local value is >= max(localValueBefore, otherValue) is NOT guaranteed (because merge uses max per entry, not per total). But commutativity, idempotency, and associativity hold.
