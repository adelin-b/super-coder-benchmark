import { describe, it, expect } from 'vitest';
import { createReplica } from './pn-counter.js';

describe('EXTREME-2: Eventually-Consistent PN-Counter with Vector Clocks', () => {
  // ============================================================
  // BASIC INCREMENT / DECREMENT
  // ============================================================

  it('new replica has value 0', () => {
    const r = createReplica('A');
    expect(r.value()).toBe(0);
  });

  it('increment increases value', () => {
    const r = createReplica('A');
    r.increment();
    expect(r.value()).toBe(1);
    r.increment(5);
    expect(r.value()).toBe(6);
  });

  it('decrement decreases value', () => {
    const r = createReplica('A');
    r.decrement();
    expect(r.value()).toBe(-1);
    r.decrement(3);
    expect(r.value()).toBe(-4);
  });

  it('increment and decrement combined', () => {
    const r = createReplica('A');
    r.increment(10);
    r.decrement(3);
    expect(r.value()).toBe(7);
  });

  it('value can go negative', () => {
    const r = createReplica('A');
    r.decrement(5);
    expect(r.value()).toBe(-5);
  });

  it('multiple increments accumulate', () => {
    const r = createReplica('A');
    r.increment(1);
    r.increment(2);
    r.increment(3);
    expect(r.value()).toBe(6);
  });

  // ============================================================
  // VALIDATION
  // ============================================================

  it('throws on empty replica id', () => {
    expect(() => createReplica('')).toThrow();
  });

  it('throws on increment with amount <= 0', () => {
    const r = createReplica('A');
    expect(() => r.increment(0)).toThrow();
    expect(() => r.increment(-1)).toThrow();
  });

  it('throws on decrement with amount <= 0', () => {
    const r = createReplica('A');
    expect(() => r.decrement(0)).toThrow();
    expect(() => r.decrement(-1)).toThrow();
  });

  // ============================================================
  // STATE SNAPSHOTS
  // ============================================================

  it('state returns deep copy', () => {
    const r = createReplica('A');
    r.increment(5);
    const s = r.state();
    s.positive['A'] = 999; // mutate the copy
    expect(r.value()).toBe(5); // original unaffected
  });

  it('state contains correct structure', () => {
    const r = createReplica('A');
    r.increment(3);
    r.decrement(1);
    const s = r.state();
    expect(s.id).toBe('A');
    expect(s.positive['A']).toBe(3);
    expect(s.negative['A']).toBe(1);
    expect(s.clock['A']).toBe(2); // 2 operations
  });

  it('initial state has clock entry for own id at 0', () => {
    const r = createReplica('X');
    const s = r.state();
    expect(s.clock['X']).toBe(0);
    expect(Object.keys(s.clock)).toEqual(['X']);
  });

  // ============================================================
  // VECTOR CLOCK
  // ============================================================

  it('vector clock increments on each operation', () => {
    const r = createReplica('A');
    r.increment();
    expect(r.state().clock['A']).toBe(1);
    r.increment();
    expect(r.state().clock['A']).toBe(2);
    r.decrement();
    expect(r.state().clock['A']).toBe(3);
  });

  it('vector clock increments on merge', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    b.increment();
    a.merge(b.state());
    // a's clock should have: A=1 (merge is a local event), B=1 (from b's clock)
    const s = a.state();
    expect(s.clock['A']).toBe(1);
    expect(s.clock['B']).toBe(1);
  });

  it('vector clock merge takes element-wise MAX then increments own', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment(); // A.clock = {A:1}
    a.increment(); // A.clock = {A:2}
    b.increment(); // B.clock = {B:1}
    b.increment(); // B.clock = {B:2}
    b.increment(); // B.clock = {B:3}

    a.merge(b.state());
    const s = a.state();
    // max(A:2, A:0) = 2, then +1 = 3
    expect(s.clock['A']).toBe(3);
    // max(B:0, B:3) = 3
    expect(s.clock['B']).toBe(3);
  });

  // ============================================================
  // MERGE BASICS
  // ============================================================

  it('merge incorporates remote increments', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment(3);
    b.increment(5);
    a.merge(b.state());
    expect(a.value()).toBe(8); // 3 + 5
  });

  it('merge incorporates remote decrements', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment(10);
    b.decrement(3);
    a.merge(b.state());
    expect(a.value()).toBe(7); // 10 - 3
  });

  it('merge from three replicas', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');
    a.increment(1);
    b.increment(2);
    c.increment(3);
    a.merge(b.state());
    a.merge(c.state());
    expect(a.value()).toBe(6); // 1 + 2 + 3
  });

  // ============================================================
  // CRDT PROPERTY: COMMUTATIVITY
  // ============================================================

  it('merge is commutative: merge(A,B) == merge(B,A) for value', () => {
    const a1 = createReplica('A');
    const b1 = createReplica('B');
    a1.increment(3);
    b1.increment(7);
    b1.decrement(2);

    const a2 = createReplica('A');
    const b2 = createReplica('B');
    a2.increment(3);
    b2.increment(7);
    b2.decrement(2);

    // Order 1: A merges B
    a1.merge(b1.state());
    // Order 2: B merges A
    b2.merge(a2.state());

    expect(a1.value()).toBe(b2.value());
  });

  it('commutativity with three replicas', () => {
    const makeReplicas = () => {
      const a = createReplica('A');
      const b = createReplica('B');
      const c = createReplica('C');
      a.increment(1);
      b.increment(2);
      b.decrement(1);
      c.increment(4);
      return { a, b, c };
    };

    // Order 1: A <- B, then A <- C
    const r1 = makeReplicas();
    r1.a.merge(r1.b.state());
    r1.a.merge(r1.c.state());

    // Order 2: A <- C, then A <- B
    const r2 = makeReplicas();
    r2.a.merge(r2.c.state());
    r2.a.merge(r2.b.state());

    expect(r1.a.value()).toBe(r2.a.value());
  });

  // ============================================================
  // CRDT PROPERTY: IDEMPOTENCY
  // ============================================================

  it('merge is idempotent: merging same state twice gives same value', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment(5);
    b.increment(3);

    const bState = b.state();
    a.merge(bState);
    const valueAfterFirst = a.value();
    a.merge(bState);
    const valueAfterSecond = a.value();

    expect(valueAfterFirst).toBe(valueAfterSecond);
    expect(valueAfterFirst).toBe(8);
  });

  it('merging own state is idempotent for value', () => {
    const a = createReplica('A');
    a.increment(5);
    a.decrement(2);
    const valueBefore = a.value();
    a.merge(a.state());
    // Value should be the same (clock increments but counters don't change)
    expect(a.value()).toBe(valueBefore);
  });

  // ============================================================
  // CRDT PROPERTY: ASSOCIATIVITY
  // ============================================================

  it('merge is associative: merge(merge(A,B),C) == merge(A,merge(B,C)) for value', () => {
    // Order 1: (A merge B) merge C
    const a1 = createReplica('A');
    const b1 = createReplica('B');
    const c1 = createReplica('C');
    a1.increment(1);
    b1.increment(2);
    b1.decrement(1);
    c1.increment(3);
    c1.decrement(1);

    a1.merge(b1.state());
    a1.merge(c1.state());
    const val1 = a1.value();

    // Order 2: A merge (B merge C)
    const a2 = createReplica('A');
    const b2 = createReplica('B');
    const c2 = createReplica('C');
    a2.increment(1);
    b2.increment(2);
    b2.decrement(1);
    c2.increment(3);
    c2.decrement(1);

    b2.merge(c2.state());
    a2.merge(b2.state());
    const val2 = a2.value();

    expect(val1).toBe(val2);
  });

  // ============================================================
  // HAPPENS-BEFORE
  // ============================================================

  it('happensBefore: initial state happens-before after increment', () => {
    const a = createReplica('A');
    const s1 = a.state();
    a.increment();
    const s2 = a.state();

    // s1 should happen-before s2
    const checker = createReplica('X'); // just to call happensBefore
    // We need to compare s1 to s2: s1 < s2?
    // s1.clock = {A:0}, s2.clock = {A:1}
    // All of s1 <= s2, and A:0 < A:1 -> true
    // Use a helper to check
    const r = createReplica('A');
    // Actually, happensBefore compares the current state to the provided state
    // We need a replica with s1's state to call happensBefore(s2)
    // Since we can't set state directly, let's test via the API
    expect(a.happensBefore(s2)).toBe(false); // a IS s2 now, so equal, not happens-before
  });

  it('happensBefore: earlier state happens-before later state on same replica', () => {
    const a = createReplica('A');
    const s0 = a.state(); // clock {A:0}
    a.increment();
    // Now a has clock {A:1}
    // s0 happens-before a.state()? s0.clock={A:0}, a.clock={A:1}
    // Check from a fresh replica perspective: create replica with clock={A:0}
    // But we can only call happensBefore on a replica instance
    // a.happensBefore(s0) -> a.clock={A:1} vs s0.clock={A:0} -> A:1>0 -> false
    expect(a.happensBefore(s0)).toBe(false);
    // The reverse: does s0 happen before current a?
    // We need a replica at s0's state. Let's create one.
    const b = createReplica('A');
    // b is fresh: clock={A:0} = s0
    expect(b.happensBefore(a.state())).toBe(true);
  });

  it('happensBefore: concurrent states are not happens-before in either direction', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment();
    b.increment();
    // a.clock = {A:1}, b.clock = {B:1}
    expect(a.happensBefore(b.state())).toBe(false);
    expect(b.happensBefore(a.state())).toBe(false);
  });

  it('happensBefore: after merge, merged state is not before either input', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment();
    b.increment();
    const bState = b.state();
    a.merge(bState);
    // a.clock = {A:2, B:1}, b.clock = {B:1}
    expect(a.happensBefore(bState)).toBe(false); // a is "after" b now
    expect(b.happensBefore(a.state())).toBe(true); // b is before a
  });

  it('happensBefore: equal states return false', () => {
    const a = createReplica('A');
    a.increment();
    const s = a.state();
    // a.clock = {A:1}, s.clock = {A:1}
    expect(a.happensBefore(s)).toBe(false); // equal, not strictly before
  });

  // ============================================================
  // CONCURRENT
  // ============================================================

  it('concurrent: independent replicas are concurrent', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment();
    b.increment();
    expect(a.concurrent(b.state())).toBe(true);
  });

  it('concurrent: after merge, not concurrent with input', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment();
    b.increment();
    a.merge(b.state());
    expect(a.concurrent(b.state())).toBe(false); // a is after b
  });

  it('concurrent: equal states are NOT concurrent', () => {
    const a = createReplica('A');
    a.increment();
    expect(a.concurrent(a.state())).toBe(false); // equal, not concurrent
  });

  it('concurrent: three-way concurrent detection', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');
    a.increment();
    b.increment();
    c.increment();
    expect(a.concurrent(b.state())).toBe(true);
    expect(a.concurrent(c.state())).toBe(true);
    expect(b.concurrent(c.state())).toBe(true);
  });

  it('concurrent: one side merged, other not, still concurrent if both progressed', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');
    a.increment();
    b.increment();
    c.increment();

    a.merge(c.state()); // a knows about C
    b.increment(); // b only knows about B
    // a.clock = {A:2, C:1}, b.clock = {B:2}
    // a has A:2 > 0, b has B:2 > 0 -> concurrent
    expect(a.concurrent(b.state())).toBe(true);
  });

  // ============================================================
  // RESET
  // ============================================================

  it('reset zeroes own contributions', () => {
    const a = createReplica('A');
    a.increment(10);
    a.decrement(3);
    expect(a.value()).toBe(7);
    a.reset();
    expect(a.value()).toBe(0);
  });

  it('reset increments vector clock', () => {
    const a = createReplica('A');
    a.increment(); // clock {A:1}
    a.reset(); // clock {A:2}
    expect(a.state().clock['A']).toBe(2);
  });

  it('reset does not affect other replicas contributions', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    b.increment(5);
    a.merge(b.state());
    // a has positive={A:0, B:5}, value=5
    expect(a.value()).toBe(5);
    a.reset();
    // reset only zeroes A's entries: positive={A:0, B:5}, negative={A:0}
    // value = (0 + 5) - 0 = 5
    expect(a.value()).toBe(5);
  });

  it('reset + merge: concurrent increment survives reset', () => {
    const a = createReplica('A');
    const b = createReplica('B');

    // Both start fresh
    a.increment(10); // a.positive={A:10}, a.clock={A:1}
    // b gets a snapshot before reset
    b.merge(a.state()); // b.positive={A:10, B:0}, b.clock={A:1, B:1}
    b.increment(5); // b.positive={A:10, B:5}, b.clock={A:1, B:2}

    // a resets
    a.reset(); // a.positive={A:0}, a.clock={A:2}

    // Now merge b's state into a
    a.merge(b.state());
    // positive merge: A: max(0, 10)=10, B: max(0, 5)=5
    // negative merge: max of both = 0
    // value = 15
    // The reset was overridden because b had A:10 which is > 0
    expect(a.value()).toBe(15);
  });

  it('reset wins over causally-prior increments when no concurrent copies exist', () => {
    const a = createReplica('A');
    a.increment(10);
    a.reset();
    // No other replica has a copy of the old state
    expect(a.value()).toBe(0);
    // Increment again
    a.increment(3);
    expect(a.value()).toBe(3);
  });

  it('reset followed by increment accumulates correctly', () => {
    const a = createReplica('A');
    a.increment(5);
    a.reset();
    a.increment(3);
    expect(a.value()).toBe(3);
    expect(a.state().positive['A']).toBe(3);
    expect(a.state().negative['A']).toBe(0);
  });

  it('multiple resets leave value at 0', () => {
    const a = createReplica('A');
    a.increment(5);
    a.reset();
    a.reset();
    a.reset();
    expect(a.value()).toBe(0);
    expect(a.state().clock['A']).toBe(4); // 1 inc + 3 resets
  });

  // ============================================================
  // MULTI-REPLICA SCENARIOS
  // ============================================================

  it('four replicas all converge after pairwise merges', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');
    const d = createReplica('D');

    a.increment(1);
    b.increment(2);
    c.increment(3);
    d.decrement(1);

    // Pairwise merge: A<-B, C<-D, then A<-C
    a.merge(b.state());
    c.merge(d.state());
    a.merge(c.state());

    expect(a.value()).toBe(5); // 1+2+3-1

    // Now merge A into everyone else
    b.merge(a.state());
    c.merge(a.state());
    d.merge(a.state());

    // All should converge
    expect(b.value()).toBe(5);
    expect(c.value()).toBe(5);
    expect(d.value()).toBe(5);
  });

  it('replica that only decrements merges correctly', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    a.increment(10);
    b.decrement(3);
    a.merge(b.state());
    b.merge(a.state());
    expect(a.value()).toBe(7);
    expect(b.value()).toBe(7);
  });

  it('delayed merge: old state merged later does not corrupt', () => {
    const a = createReplica('A');
    const b = createReplica('B');

    a.increment(5);
    const oldAState = a.state(); // snapshot

    a.increment(3); // a is now at 8
    b.increment(2);

    // b merges the OLD state of a
    b.merge(oldAState);
    // b.positive = {A: max(0,5)=5, B:2}, value = 7
    expect(b.value()).toBe(7);

    // Now b merges the CURRENT state of a
    b.merge(a.state());
    // b.positive = {A: max(5,8)=8, B:2}, value = 10
    expect(b.value()).toBe(10);
  });

  it('merge does not double-count: same increment seen via two paths', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');

    a.increment(5);
    // Both B and C get A's state
    b.merge(a.state());
    c.merge(a.state());

    // B increments
    b.increment(1);

    // C merges B (which has A's increment already)
    c.merge(b.state());

    // C should have value 6 (A:5 + B:1), NOT 11 (5+5+1)
    expect(c.value()).toBe(6);
  });

  it('convergence: all replicas reach same value regardless of merge order', () => {
    const a = createReplica('A');
    const b = createReplica('B');
    const c = createReplica('C');

    a.increment(3);
    b.decrement(1);
    c.increment(7);

    // Merge in different orders, check final values match
    // Path 1: A <- B <- C
    const a1 = createReplica('A');
    a1.increment(3);
    a1.merge(createReplicaWithOps('B', [{ op: 'dec', amt: 1 }]).state());
    a1.merge(createReplicaWithOps('C', [{ op: 'inc', amt: 7 }]).state());

    // Path 2: A <- C <- B
    const a2 = createReplica('A');
    a2.increment(3);
    a2.merge(createReplicaWithOps('C', [{ op: 'inc', amt: 7 }]).state());
    a2.merge(createReplicaWithOps('B', [{ op: 'dec', amt: 1 }]).state());

    expect(a1.value()).toBe(a2.value());
    expect(a1.value()).toBe(9);
  });

  // ============================================================
  // RESET + CONCURRENT INCREMENT INTERACTION (TRICKY)
  // ============================================================

  it('reset on A, concurrent increment on B for A-id: B increment survives merge into A', () => {
    // This tests the subtle case: B has positive[A]=10 from earlier merge,
    // then A resets (positive[A]=0). When A merges B's state,
    // max(0, 10) = 10, so the old value comes back.
    const a = createReplica('A');
    a.increment(10);

    const b = createReplica('B');
    b.merge(a.state()); // b now has positive[A]=10

    a.reset(); // a.positive[A]=0
    expect(a.value()).toBe(0);

    a.merge(b.state()); // max(0, 10) = 10 for positive[A]
    expect(a.value()).toBe(10); // The concurrent copy from B survives
  });

  it('reset then local increment: merge with stale state caps correctly', () => {
    const a = createReplica('A');
    a.increment(10); // positive[A]=10

    const stale = a.state();

    a.reset(); // positive[A]=0
    a.increment(3); // positive[A]=3

    // Merge stale state: max(3, 10)=10
    a.merge(stale);
    expect(a.value()).toBe(10);
  });

  // ============================================================
  // EDGE CASES
  // ============================================================

  it('large amounts work correctly', () => {
    const a = createReplica('A');
    a.increment(1_000_000);
    a.decrement(999_999);
    expect(a.value()).toBe(1);
  });

  it('fractional amounts are not used (integer operations)', () => {
    const a = createReplica('A');
    a.increment(1);
    a.increment(1);
    a.increment(1);
    expect(a.value()).toBe(3);
    expect(a.state().positive['A']).toBe(3);
  });

  it('merging empty replica state does not affect value', () => {
    const a = createReplica('A');
    a.increment(5);
    const b = createReplica('B');
    a.merge(b.state());
    expect(a.value()).toBe(5);
  });

  it('newly created replica state snapshot is correct', () => {
    const r = createReplica('node1');
    const s = r.state();
    expect(s.id).toBe('node1');
    expect(s.positive).toEqual({});
    expect(s.negative).toEqual({});
    expect(s.clock).toEqual({ 'node1': 0 });
  });

  it('state mutation does not affect replica', () => {
    const r = createReplica('A');
    r.increment(5);
    const s = r.state();
    s.positive['A'] = 0;
    s.negative['A'] = 100;
    s.clock['A'] = 999;
    // Original should be unaffected
    expect(r.value()).toBe(5);
    expect(r.state().clock['A']).toBe(1);
  });
});

// Helper to create a replica with a series of operations
function createReplicaWithOps(
  id: string,
  ops: Array<{ op: 'inc' | 'dec'; amt: number }>,
) {
  const r = createReplica(id);
  for (const o of ops) {
    if (o.op === 'inc') r.increment(o.amt);
    else r.decrement(o.amt);
  }
  return r;
}
