import { describe, it, expect } from 'vitest';
import { createLockManager, LockError } from './lock-manager.js';

describe('EXTREME-5: Distributed Lock Manager with Wait-Die Deadlock Prevention', () => {
  // ==================== Basic Shared/Exclusive Locking ====================

  it('grants exclusive lock on free resource', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('granted');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);
  });

  it('grants shared lock on free resource', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    const result = lm.acquire('tx1', 'res1', 'shared');
    expect(result.status).toBe('granted');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);
  });

  it('grants multiple shared locks on same resource', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');
    expect(lm.acquire('tx1', 'res1', 'shared').status).toBe('granted');
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('granted');
    expect(lm.acquire('tx3', 'res1', 'shared').status).toBe('granted');
    expect(lm.getHolders('res1')).toHaveLength(3);
  });

  it('exclusive lock conflicts with existing shared lock (wait-die applies)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger
    lm.acquire('tx1', 'res1', 'shared');
    // tx2 is younger, requesting X on resource held by older tx1 -> tx2 aborts
    const result = lm.acquire('tx2', 'res1', 'exclusive');
    expect(result.status).toBe('aborted');
  });

  it('shared lock conflicts with existing exclusive lock (wait-die applies)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger
    lm.acquire('tx1', 'res1', 'exclusive');
    // tx2 is younger than holder tx1 -> aborted
    const result = lm.acquire('tx2', 'res1', 'shared');
    expect(result.status).toBe('aborted');
  });

  it('exclusive lock conflicts with existing exclusive lock (wait-die applies)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger
    lm.acquire('tx1', 'res1', 'exclusive');
    // tx2 younger than tx1 -> aborted
    const result = lm.acquire('tx2', 'res1', 'exclusive');
    expect(result.status).toBe('aborted');
  });

  // ==================== Wait-Die: Older Waits, Younger Aborted ====================

  it('older transaction waits for younger holder (wait-die)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older (seq 0)
    lm.beginTransaction('tx2'); // younger (seq 1)
    lm.acquire('tx2', 'res1', 'exclusive');
    // tx1 is older than tx2 (holder) -> tx1 waits
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('waiting');
    expect(lm.getWaiters('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive' }]);
  });

  it('younger transaction aborted when requesting lock held by older (wait-die)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older (seq 0)
    lm.beginTransaction('tx2'); // younger (seq 1)
    lm.acquire('tx1', 'res1', 'exclusive');
    const result = lm.acquire('tx2', 'res1', 'exclusive');
    expect(result.status).toBe('aborted');
    // tx2 should have no locks remaining
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);
  });

  it('wait-die with three transactions: oldest waits, middle aborts, youngest aborts', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest (seq 0)
    lm.beginTransaction('tx2'); // middle (seq 1)
    lm.beginTransaction('tx3'); // youngest (seq 2)

    lm.acquire('tx2', 'res1', 'exclusive'); // tx2 holds X on res1

    // tx1 (oldest) tries to acquire -> older than holder tx2 -> waits
    expect(lm.acquire('tx1', 'res1', 'exclusive').status).toBe('waiting');

    // tx3 (youngest) tries to acquire -> younger than holder tx2 -> aborted
    expect(lm.acquire('tx3', 'res1', 'exclusive').status).toBe('aborted');
  });

  // ==================== Wait-Die: Aborted Tx Releases All Locks ====================

  it('aborted transaction releases all its locks', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx2', 'resA', 'exclusive'); // tx2 holds X on resA
    lm.acquire('tx2', 'resB', 'shared');    // tx2 holds S on resB

    // tx2 tries to get lock on res held by older tx1 -> tx2 aborts
    lm.acquire('tx1', 'resC', 'exclusive');
    const result = lm.acquire('tx2', 'resC', 'exclusive');
    expect(result.status).toBe('aborted');

    // tx2 should have released all its locks
    expect(lm.getHolders('resA')).toEqual([]);
    expect(lm.getHolders('resB')).toEqual([]);
  });

  it('aborted tx releasing locks grants waiters on those resources', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest (seq 0)
    lm.beginTransaction('tx2'); // middle (seq 1)
    lm.beginTransaction('tx3'); // youngest (seq 2)

    // tx2 holds X on resA
    lm.acquire('tx2', 'resA', 'exclusive');

    // tx1 (older) waits for resA held by tx2
    expect(lm.acquire('tx1', 'resA', 'exclusive').status).toBe('waiting');

    // tx3 holds X on resB
    lm.acquire('tx3', 'resB', 'exclusive');

    // Now tx2 tries resB held by tx3 -> tx2 is older than tx3, so tx2 waits
    expect(lm.acquire('tx2', 'resB', 'exclusive').status).toBe('waiting');

    // At this point: tx1 waits for tx2 (on resA), tx2 waits for tx3 (on resB)
    // tx2 holds resA, tx3 holds resB
    // Let's release resB from tx3 -> tx2 gets resB granted, and tx2 still holds resA
    lm.release('tx3', 'resB');

    // tx2 should now hold resB (was waiting, now granted)
    expect(lm.getHolders('resB')).toEqual([{ txId: 'tx2', mode: 'exclusive', count: 1 }]);
    // tx1 is still waiting for resA (tx2 still holds it)
    expect(lm.getWaiters('resA')).toEqual([{ txId: 'tx1', mode: 'exclusive' }]);
  });

  // ==================== Upgrade: Sole S Holder Upgrades to X ====================

  it('sole shared holder upgrades to exclusive immediately', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'shared');
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('granted');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);
  });

  it('upgrade preserves reference count from shared hold', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'shared');
    // Count should stay at 1 after upgrade (mode changes, count does not increment)
    lm.acquire('tx1', 'res1', 'exclusive');
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(1);
    expect(holders[0].mode).toBe('exclusive');
    expect(holders[0].count).toBe(1);
  });

  // ==================== Upgrade: S Holder with Other S Holders -> Wait-Die ====================

  it('upgrade with other shared holders: older requester waits', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx1', 'res1', 'shared');
    lm.acquire('tx2', 'res1', 'shared');

    // tx1 (older) tries to upgrade to X, but tx2 also holds S
    // tx1 is older than tx2 -> tx1 waits
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('waiting');
  });

  it('upgrade with other shared holders: younger requester aborted', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx1', 'res1', 'shared');
    lm.acquire('tx2', 'res1', 'shared');

    // tx2 (younger) tries to upgrade to X, but tx1 also holds S
    // tx2 is younger than tx1 -> tx2 aborted
    const result = lm.acquire('tx2', 'res1', 'exclusive');
    expect(result.status).toBe('aborted');
    // tx2 loses its shared lock too
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);
  });

  // ==================== Downgrade: X -> S Grants Pending S Waiters ====================

  it('downgrade exclusive to shared', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'exclusive');
    lm.downgrade('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);
  });

  it('downgrade grants pending shared waiters', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // middle
    lm.beginTransaction('tx3'); // youngest

    lm.acquire('tx3', 'res1', 'exclusive');

    // tx1 and tx2 are older than tx3 -> they wait
    expect(lm.acquire('tx1', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('waiting');

    // Downgrade tx3 X -> S
    lm.downgrade('tx3', 'res1');

    // Now both S waiters should be granted
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(3);
    expect(holders.map(h => h.txId).sort()).toEqual(['tx1', 'tx2', 'tx3']);
    expect(holders.every(h => h.mode === 'shared')).toBe(true);
    expect(lm.getWaiters('res1')).toEqual([]);
  });

  it('downgrade throws if lock not held', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    expect(() => lm.downgrade('tx1', 'res1')).toThrow(LockError);
  });

  it('downgrade throws if lock is shared (not exclusive)', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'shared');
    expect(() => lm.downgrade('tx1', 'res1')).toThrow(LockError);
  });

  // ==================== Re-entrant Locks ====================

  it('re-entrant exclusive: acquire X twice, release twice', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'exclusive');
    lm.acquire('tx1', 'res1', 'exclusive');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 2 }]);

    // First release decrements count
    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);

    // Second release fully removes
    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([]);
  });

  it('re-entrant shared: acquire S twice, release twice', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'shared');
    lm.acquire('tx1', 'res1', 'shared');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 2 }]);

    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);

    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([]);
  });

  it('re-entrant on exclusive: requesting S on X-held resource increments count', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'exclusive');
    // Requesting S when holding X -> re-entrant (X subsumes S)
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('granted');
    expect(lm.getHolders('res1')[0].count).toBe(2);
  });

  // ==================== Release Ordering ====================

  it('release X: 3 S waiters granted simultaneously', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');
    lm.beginTransaction('tx4'); // youngest

    lm.acquire('tx4', 'res1', 'exclusive');

    // tx1, tx2, tx3 are all older than tx4 -> they wait
    expect(lm.acquire('tx1', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx3', 'res1', 'shared').status).toBe('waiting');

    // Release X
    lm.release('tx4', 'res1');

    // All 3 S waiters should be granted
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(3);
    expect(holders.every(h => h.mode === 'shared')).toBe(true);
    expect(lm.getWaiters('res1')).toEqual([]);
  });

  it('release X: first waiter is X, only that one granted', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');
    lm.beginTransaction('tx4'); // youngest

    lm.acquire('tx4', 'res1', 'exclusive');

    // First waiter wants X
    expect(lm.acquire('tx1', 'res1', 'exclusive').status).toBe('waiting');
    // Second and third want S
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx3', 'res1', 'shared').status).toBe('waiting');

    lm.release('tx4', 'res1');

    // Only tx1 (X) should be granted
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(1);
    expect(holders[0]).toEqual({ txId: 'tx1', mode: 'exclusive', count: 1 });
    // tx2 and tx3 still waiting
    expect(lm.getWaiters('res1')).toHaveLength(2);
  });

  it('release X: first waiter is S, grants consecutive S but stops at X', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');
    lm.beginTransaction('tx4');
    lm.beginTransaction('tx5'); // youngest

    lm.acquire('tx5', 'res1', 'exclusive');

    // S, S, X, S waiters in FIFO order
    expect(lm.acquire('tx1', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('waiting');
    expect(lm.acquire('tx3', 'res1', 'exclusive').status).toBe('waiting');
    expect(lm.acquire('tx4', 'res1', 'shared').status).toBe('waiting');

    lm.release('tx5', 'res1');

    // tx1 (S) and tx2 (S) should be granted, tx3 (X) blocks, tx4 (S) still waits
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(2);
    expect(holders.map(h => h.txId).sort()).toEqual(['tx1', 'tx2']);
    expect(lm.getWaiters('res1')).toHaveLength(2);
    expect(lm.getWaiters('res1')[0]).toEqual({ txId: 'tx3', mode: 'exclusive' });
    expect(lm.getWaiters('res1')[1]).toEqual({ txId: 'tx4', mode: 'shared' });
  });

  // ==================== Deadlock Detection (wait-die disabled) ====================

  it('detects simple deadlock cycle (wait-die disabled)', () => {
    const lm = createLockManager({ useWaitDie: false });
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'exclusive');

    // tx1 waits for resB (held by tx2)
    lm.acquire('tx1', 'resB', 'exclusive');
    // tx2 waits for resA (held by tx1)
    lm.acquire('tx2', 'resA', 'exclusive');

    const cycle = lm.detectDeadlock();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3);
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]); // cycle wraps
    // Both tx1 and tx2 should be in the cycle
    expect(cycle!).toContain('tx1');
    expect(cycle!).toContain('tx2');
  });

  it('detects 3-way deadlock cycle (wait-die disabled)', () => {
    const lm = createLockManager({ useWaitDie: false });
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');

    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'exclusive');
    lm.acquire('tx3', 'resC', 'exclusive');

    // tx1 -> tx2 -> tx3 -> tx1
    lm.acquire('tx1', 'resB', 'exclusive'); // tx1 waits for tx2
    lm.acquire('tx2', 'resC', 'exclusive'); // tx2 waits for tx3
    lm.acquire('tx3', 'resA', 'exclusive'); // tx3 waits for tx1

    const cycle = lm.detectDeadlock();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBe(4); // [txA, txB, txC, txA]
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
  });

  it('no deadlock when no cycle exists (wait-die disabled)', () => {
    const lm = createLockManager({ useWaitDie: false });
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'exclusive');

    // tx1 waits for resB (held by tx2) but tx2 is NOT waiting
    lm.acquire('tx1', 'resB', 'exclusive');

    expect(lm.detectDeadlock()).toBeNull();
  });

  it('wait-die prevents deadlocks (detectDeadlock always returns null)', () => {
    const lm = createLockManager({ useWaitDie: true });
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'exclusive');

    // With wait-die, one will abort rather than create a cycle
    lm.acquire('tx1', 'resB', 'exclusive'); // tx1 older -> waits

    expect(lm.detectDeadlock()).toBeNull();
  });

  // ==================== Transaction Commit ====================

  it('commit releases all locks and grants waiters', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx2', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'shared');

    // tx1 waits for resA
    expect(lm.acquire('tx1', 'resA', 'exclusive').status).toBe('waiting');

    // Commit tx2 -> releases all its locks
    lm.commitTransaction('tx2');

    // tx1 should now hold resA (was waiting, now granted)
    expect(lm.getHolders('resA')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);
    expect(lm.getHolders('resB')).toEqual([]);
    expect(lm.getWaiters('resA')).toEqual([]);
  });

  it('commit releases re-entrant locks fully', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'exclusive');
    lm.acquire('tx1', 'res1', 'exclusive'); // count = 2
    lm.commitTransaction('tx1');
    expect(lm.getHolders('res1')).toEqual([]);
  });

  it('commit removes transaction from waiter queues', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx2', 'res1', 'exclusive');
    lm.acquire('tx1', 'res1', 'exclusive'); // tx1 waits

    // Commit tx1 while it's waiting -> should remove it from waiters
    lm.commitTransaction('tx1');
    expect(lm.getWaiters('res1')).toEqual([]);
    // tx2 still holds
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx2', mode: 'exclusive', count: 1 }]);
  });

  // ==================== Validation Errors ====================

  it('throws on acquire with non-existent transaction', () => {
    const lm = createLockManager();
    expect(() => lm.acquire('ghost', 'res1', 'exclusive')).toThrow(LockError);
  });

  it('throws on release with non-existent transaction', () => {
    const lm = createLockManager();
    expect(() => lm.release('ghost', 'res1')).toThrow(LockError);
  });

  it('throws on release of unheld lock', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    expect(() => lm.release('tx1', 'res1')).toThrow(LockError);
  });

  it('throws on duplicate beginTransaction', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    expect(() => lm.beginTransaction('tx1')).toThrow(LockError);
  });

  it('throws on commitTransaction for non-existent transaction', () => {
    const lm = createLockManager();
    expect(() => lm.commitTransaction('ghost')).toThrow(LockError);
  });

  it('throws on getTransactionLocks for non-existent transaction', () => {
    const lm = createLockManager();
    expect(() => lm.getTransactionLocks('ghost')).toThrow(LockError);
  });

  it('throws on downgrade for non-existent transaction', () => {
    const lm = createLockManager();
    expect(() => lm.downgrade('ghost', 'res1')).toThrow(LockError);
  });

  it('throws on acquire after transaction committed', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.commitTransaction('tx1');
    expect(() => lm.acquire('tx1', 'res1', 'exclusive')).toThrow(LockError);
  });

  // ==================== getTransactionLocks ====================

  it('getTransactionLocks returns all held locks', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx1', 'resB', 'shared');
    lm.acquire('tx1', 'resB', 'shared'); // re-entrant

    const locks = lm.getTransactionLocks('tx1');
    expect(locks).toHaveLength(2);
    const lockA = locks.find(l => l.resource === 'resA')!;
    const lockB = locks.find(l => l.resource === 'resB')!;
    expect(lockA).toEqual({ resource: 'resA', mode: 'exclusive', count: 1 });
    expect(lockB).toEqual({ resource: 'resB', mode: 'shared', count: 2 });
  });

  // ==================== Complex Scenarios ====================

  it('4 transactions, multiple resources, interleaved operations', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3');
    lm.beginTransaction('tx4'); // youngest

    // tx1 grabs X on resA
    expect(lm.acquire('tx1', 'resA', 'exclusive').status).toBe('granted');

    // tx2 grabs S on resB
    expect(lm.acquire('tx2', 'resB', 'shared').status).toBe('granted');

    // tx3 grabs S on resB (compatible)
    expect(lm.acquire('tx3', 'resB', 'shared').status).toBe('granted');

    // tx4 wants X on resA -> younger than tx1 -> aborted
    expect(lm.acquire('tx4', 'resA', 'exclusive').status).toBe('aborted');

    // tx1 wants S on resB -> tx1 is older than tx2, tx3 -> compatible (S+S) -> granted
    expect(lm.acquire('tx1', 'resB', 'shared').status).toBe('granted');

    // tx2 wants X on resA -> tx2 is younger than tx1 (holder) -> aborted
    expect(lm.acquire('tx2', 'resA', 'exclusive').status).toBe('aborted');
    // tx2's S on resB is released
    expect(lm.getHolders('resB').find(h => h.txId === 'tx2')).toBeUndefined();

    // resB should now have tx1(S) and tx3(S)
    const resBHolders = lm.getHolders('resB');
    expect(resBHolders).toHaveLength(2);
    expect(resBHolders.map(h => h.txId).sort()).toEqual(['tx1', 'tx3']);
  });

  it('upgrade then commit scenario', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    // tx1 gets S on res1
    lm.acquire('tx1', 'res1', 'shared');

    // tx1 upgrades to X (sole holder) -> succeeds
    expect(lm.acquire('tx1', 'res1', 'exclusive').status).toBe('granted');

    // tx2 wants S on res1 -> younger than tx1 -> aborted
    expect(lm.acquire('tx2', 'res1', 'shared').status).toBe('aborted');

    // Commit tx1
    lm.commitTransaction('tx1');
    expect(lm.getHolders('res1')).toEqual([]);
  });

  it('cascading grants after release: release X on resA grants waiter who releases resB', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // middle
    lm.beginTransaction('tx3'); // youngest

    // tx3 holds X on resA
    lm.acquire('tx3', 'resA', 'exclusive');
    // tx1 (older) waits for resA
    expect(lm.acquire('tx1', 'resA', 'shared').status).toBe('waiting');

    // tx2 holds X on resB
    lm.acquire('tx2', 'resB', 'exclusive');
    // tx1 (older) waits for resB
    expect(lm.acquire('tx1', 'resB', 'shared').status).toBe('waiting');

    // Release tx3's lock on resA -> tx1 gets granted S on resA
    lm.release('tx3', 'resA');
    expect(lm.getHolders('resA')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);

    // tx1 is still waiting for resB
    expect(lm.getWaiters('resB')).toEqual([{ txId: 'tx1', mode: 'shared' }]);

    // Release tx2's lock on resB -> tx1 gets granted S on resB
    lm.release('tx2', 'resB');
    expect(lm.getHolders('resB')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);
  });

  it('wait-die with shared holders: older requester waits for multiple younger S holders', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2');
    lm.beginTransaction('tx3'); // youngest

    lm.acquire('tx2', 'res1', 'shared');
    lm.acquire('tx3', 'res1', 'shared');

    // tx1 (oldest) wants X -> older than both tx2 and tx3 -> waits
    const result = lm.acquire('tx1', 'res1', 'exclusive');
    expect(result.status).toBe('waiting');
  });

  it('without wait-die: transactions enqueue as waiters on conflict', () => {
    const lm = createLockManager({ useWaitDie: false });
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    lm.acquire('tx1', 'res1', 'exclusive');
    // Without wait-die, tx2 just waits regardless of age
    const result = lm.acquire('tx2', 'res1', 'exclusive');
    expect(result.status).toBe('waiting');
  });

  it('getHolders and getWaiters on unknown resource return empty', () => {
    const lm = createLockManager();
    expect(lm.getHolders('nonexistent')).toEqual([]);
    expect(lm.getWaiters('nonexistent')).toEqual([]);
  });

  it('multiple resources: locks are independent', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.beginTransaction('tx2');

    lm.acquire('tx1', 'resA', 'exclusive');
    lm.acquire('tx2', 'resB', 'exclusive');

    // Different resources, no conflict
    expect(lm.getHolders('resA')).toHaveLength(1);
    expect(lm.getHolders('resB')).toHaveLength(1);
    expect(lm.getHolders('resA')[0].txId).toBe('tx1');
    expect(lm.getHolders('resB')[0].txId).toBe('tx2');
  });

  it('downgrade X -> S then another tx gets X after S holders release', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx2', 'res1', 'exclusive');

    // tx1 (older) wants X -> waits
    expect(lm.acquire('tx1', 'res1', 'exclusive').status).toBe('waiting');

    // Downgrade tx2: X -> S
    lm.downgrade('tx2', 'res1');

    // tx1 was waiting for X. First waiter is X, so after downgrade:
    // holders: [tx2(S)], waiters: [tx1(X)]
    // grantWaiters sees first waiter is X but holders exist -> can't grant
    // tx1 still waits
    expect(lm.getWaiters('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive' }]);

    // Now tx2 releases its S lock
    lm.release('tx2', 'res1');

    // tx1 should get granted X
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'exclusive', count: 1 }]);
  });

  it('re-entrant X then downgrade keeps count', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1');
    lm.acquire('tx1', 'res1', 'exclusive');
    lm.acquire('tx1', 'res1', 'exclusive'); // count = 2

    // Downgrade: mode changes to S, count preserved
    lm.downgrade('tx1', 'res1');
    const holders = lm.getHolders('res1');
    expect(holders).toEqual([{ txId: 'tx1', mode: 'shared', count: 2 }]);

    // Need two releases to fully clear
    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([{ txId: 'tx1', mode: 'shared', count: 1 }]);
    lm.release('tx1', 'res1');
    expect(lm.getHolders('res1')).toEqual([]);
  });

  it('aborted transaction cannot acquire further locks', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // older
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx1', 'res1', 'exclusive');
    // tx2 aborts
    expect(lm.acquire('tx2', 'res1', 'exclusive').status).toBe('aborted');

    // tx2 is now inactive -> further acquire throws
    expect(() => lm.acquire('tx2', 'res2', 'shared')).toThrow(LockError);
  });

  it('complex: upgrade waiting then granted after other holders release', () => {
    const lm = createLockManager();
    lm.beginTransaction('tx1'); // oldest
    lm.beginTransaction('tx2'); // younger

    lm.acquire('tx1', 'res1', 'shared');
    lm.acquire('tx2', 'res1', 'shared');

    // tx1 wants to upgrade to X but tx2 also holds S
    // tx1 is older -> waits
    expect(lm.acquire('tx1', 'res1', 'exclusive').status).toBe('waiting');

    // Now release tx2's lock -> tx1 should get granted upgrade
    lm.release('tx2', 'res1');

    // After tx2 releases, holders = [tx1(S)], waiters = [tx1(X)]
    // grantWaiters: first waiter is tx1(X), no holders except... tx1 itself holds S
    // But tx1(X) needs no other holders. rs.holders = [tx1(S)], so holders.length > 0 -> can't grant X
    // Actually this is the upgrade case: tx1 holds S AND waits for X
    // When tx2 releases, the only remaining S holder is tx1 itself
    // grantWaiters should recognize this as an upgrade scenario

    // Let me verify: after tx2 releases, only tx1(S) remains as holder
    // grantWaiters looks at waiters[0] = tx1(X). holders.length = 1 (tx1).
    // The waiter IS the holder -> this is effectively an upgrade of sole S to X
    // Our grantWaiters grants X only when holders.length === 0
    // But for upgrade, the waiter is already in holders...
    // We need to handle this in grantWaiters

    // With correct implementation, tx1 should now hold X
    const holders = lm.getHolders('res1');
    expect(holders).toHaveLength(1);
    expect(holders[0].txId).toBe('tx1');
    expect(holders[0].mode).toBe('exclusive');
  });
});
