# EXTREME-5: Distributed Lock Manager with Wait-Die Deadlock Prevention

## Overview
Implement a lock manager supporting shared/exclusive modes with wait-die deadlock prevention. The system manages transactions that acquire and release locks on named resources, with support for lock upgrades, downgrades, re-entrant locking, and deadlock detection.

## Exported API

```ts
export type LockMode = 'shared' | 'exclusive';

export interface AcquireResult {
  status: 'granted' | 'waiting' | 'aborted';
}

export interface LockHolder {
  txId: string;
  mode: LockMode;
  count: number;
}

export interface LockWaiter {
  txId: string;
  mode: LockMode;
}

export interface TransactionLock {
  resource: string;
  mode: LockMode;
  count: number;
}

export class LockError extends Error {}

export function createLockManager(config?: { useWaitDie?: boolean }): {
  beginTransaction(txId: string): void;
  acquire(txId: string, resource: string, mode: LockMode): AcquireResult;
  release(txId: string, resource: string): void;
  downgrade(txId: string, resource: string): void;
  commitTransaction(txId: string): void;
  getHolders(resource: string): LockHolder[];
  getWaiters(resource: string): LockWaiter[];
  detectDeadlock(): string[] | null;
  getTransactionLocks(txId: string): TransactionLock[];
};
```

## Detailed Requirements

### Lock Modes
- **Shared (S)**: Multiple transactions can hold simultaneously on the same resource.
- **Exclusive (X)**: Only one transaction can hold; no shared locks allowed concurrently.

### Acquire: `acquire(txId, resource, mode)` -> `AcquireResult`
- If resource is free (no holders) -> grant immediately.
- If requesting shared and only shared locks are held -> grant immediately.
- If conflict exists -> apply wait-die rule (if enabled) or enqueue as waiter.

### Wait-Die Rule (younger dies, older waits)
- Transaction age is determined by `beginTransaction(txId)` call order (sequence number). Lower sequence = older = higher priority.
- If requester is OLDER than ALL current holders -> it WAITS (enqueued).
- If requester is YOUNGER than ANY current holder -> it is ABORTED (dies).
- Aborted transactions release ALL their locks, which may trigger granting waiters on those resources.

### Lock Upgrade
- A transaction holding S can request X on the same resource.
- If it is the ONLY shared holder -> upgrade immediately (mode changes to X, count stays).
- If other shared holders exist -> apply wait-die rule (may wait or abort).
- Self-deadlock prevention: upgrading when you hold the only S lock always succeeds.

### Lock Downgrade
- A transaction holding X can call `downgrade(txId, resource)` to change to S.
- After downgrade, pending shared waiters can be granted.
- Downgrading a shared lock or a lock not held throws `LockError`.

### Release: `release(txId, resource)`
- Decrements the reference count for the lock.
- If count reaches 0, removes the holder entirely.
- If waiters exist after removal, grant compatible waiting requests in FIFO order:
  - If the first waiter wants X, only grant that one.
  - If the first waiter wants S, grant all consecutive S waiters (batch grant).
- Releasing a lock not held by the transaction throws `LockError`.

### Re-entrant Locks
- A transaction that already holds X can call `acquire(X)` again -> reference count increments. Must release the same number of times.
- A transaction that already holds S can call `acquire(S)` again -> reference count increments.

### Deadlock Detection (when wait-die is disabled)
- `detectDeadlock()` builds a wait-for graph and returns a cycle as a list of transaction IDs, or null if no cycle exists.
- The cycle should be returned as `[txA, txB, ..., txA]` (first element repeated at end).
- When wait-die is enabled, `detectDeadlock()` always returns null (wait-die prevents deadlocks).

### Transaction Lifecycle
- `beginTransaction(txId)` registers a new transaction. Throws `LockError` if txId already exists.
- `commitTransaction(txId)` releases all locks held by the transaction (triggering waiter grants) and removes the transaction. Throws `LockError` if txId does not exist.

### Validation
- `acquire` on a non-existent transaction throws `LockError`.
- `release` on a non-existent transaction throws `LockError`.
- `release` of a lock not held by the transaction throws `LockError`.
- Duplicate `beginTransaction` with same txId throws `LockError`.
- `commitTransaction` on non-existent transaction throws `LockError`.
- `downgrade` on non-existent transaction or unheld resource throws `LockError`.

### Query Methods
- `getHolders(resource)`: Returns array of current lock holders with their mode and count.
- `getWaiters(resource)`: Returns array of transactions waiting for the resource, in FIFO order.
- `getTransactionLocks(txId)`: Returns all locks held by a transaction. Throws `LockError` if transaction doesn't exist.

## Invariants
1. A resource never has both exclusive and shared holders simultaneously.
2. A resource has at most one exclusive holder at any time.
3. When wait-die is enabled, no deadlocks can occur (younger transactions abort rather than wait behind older ones).
4. Re-entrant lock count must be decremented to 0 before the lock is fully released.
5. `commitTransaction` releases all locks and removes all waiter entries for the transaction.
6. Aborting a transaction via wait-die cascades: released locks may grant waiters, which may resolve other waiting transactions.
