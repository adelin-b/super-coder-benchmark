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

export class LockError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'LockError';
    Object.setPrototypeOf(this, LockError.prototype);
  }
}

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
} {
  const useWaitDie = config?.useWaitDie ?? true;
  let seqCounter = 0;

  // txId -> sequence number (lower = older = higher priority)
  const txSeqs = new Map<string, number>();

  // resource -> Map<txId, { mode, count }>
  const holdersMap = new Map<string, Map<string, { mode: LockMode; count: number }>>();

  // resource -> Array of waiters (FIFO)
  const waitersMap = new Map<string, Array<{ txId: string; mode: LockMode }>>();

  // txId -> set of resources currently held
  const txResources = new Map<string, Set<string>>();

  // txId -> resource it's currently waiting on
  const txWaitingFor = new Map<string, string>();

  function ensureResource(resource: string): void {
    if (!holdersMap.has(resource)) holdersMap.set(resource, new Map());
    if (!waitersMap.has(resource)) waitersMap.set(resource, []);
  }

  function canGrant(
    rHolders: Map<string, { mode: LockMode; count: number }>,
    txId: string,
    mode: LockMode
  ): boolean {
    const others = [...rHolders.entries()].filter(([id]) => id !== txId);
    if (others.length === 0) return true;
    if (mode === 'exclusive') return false;
    // shared: ok only if all other holders are also shared
    return others.every(([, h]) => h.mode === 'shared');
  }

  function grantWaiters(resource: string): void {
    const rHolders = holdersMap.get(resource);
    const rWaiters = waitersMap.get(resource);
    if (!rHolders || !rWaiters) return;

    while (rWaiters.length > 0) {
      const first = rWaiters[0];

      // Skip transactions that were aborted or committed while waiting
      if (!txSeqs.has(first.txId)) {
        rWaiters.shift();
        continue;
      }

      if (!canGrant(rHolders, first.txId, first.mode)) break;

      rWaiters.shift();
      txWaitingFor.delete(first.txId);

      const existing = rHolders.get(first.txId);
      if (existing) {
        // Upgrade case: holds S, being granted X
        if (first.mode === 'exclusive' && existing.mode === 'shared') {
          existing.mode = 'exclusive';
          // count stays per spec
        } else {
          existing.count++;
        }
      } else {
        rHolders.set(first.txId, { mode: first.mode, count: 1 });
        txResources.get(first.txId)?.add(resource);
      }

      // After granting exclusive, stop (no more can be granted)
      if (first.mode === 'exclusive') break;
      // For shared, continue to batch-grant consecutive shared waiters
    }
  }

  function releaseAll(txId: string): void {
    // Remove from any waiter queues
    for (const rWaiters of waitersMap.values()) {
      const idx = rWaiters.findIndex(w => w.txId === txId);
      if (idx !== -1) rWaiters.splice(idx, 1);
    }
    txWaitingFor.delete(txId);

    // Collect resources to notify after cleanup
    const resources = txResources.has(txId) ? [...txResources.get(txId)!] : [];

    // Release all held locks
    for (const resource of resources) {
      holdersMap.get(resource)?.delete(txId);
    }
    txResources.delete(txId);
    txSeqs.delete(txId);

    // Grant waiters on all affected resources
    for (const resource of resources) {
      grantWaiters(resource);
    }
  }

  function applyWaitDieOrEnqueue(
    txId: string,
    resource: string,
    mode: LockMode,
    rHolders: Map<string, { mode: LockMode; count: number }>
  ): AcquireResult {
    const rWaiters = waitersMap.get(resource)!;

    if (useWaitDie) {
      const mySeq = txSeqs.get(txId)!;
      const holderIds = [...rHolders.keys()].filter(id => id !== txId);
      // Younger than ANY holder → abort (die)
      const youngerThanAny = holderIds.some(id => mySeq > txSeqs.get(id)!);
      if (youngerThanAny) {
        releaseAll(txId);
        return { status: 'aborted' };
      }
    }

    // Older than all holders (or wait-die disabled) → wait
    txWaitingFor.set(txId, resource);
    rWaiters.push({ txId, mode });
    return { status: 'waiting' };
  }

  return {
    beginTransaction(txId: string): void {
      if (txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} already exists`);
      }
      txSeqs.set(txId, seqCounter++);
      txResources.set(txId, new Set());
    },

    acquire(txId: string, resource: string, mode: LockMode): AcquireResult {
      if (!txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} does not exist`);
      }
      ensureResource(resource);

      const rHolders = holdersMap.get(resource)!;
      const existing = rHolders.get(txId);

      if (existing) {
        // Re-entrant: already holds exclusive → grant any mode
        if (existing.mode === 'exclusive') {
          existing.count++;
          return { status: 'granted' };
        }
        // Re-entrant: already holds shared, requesting shared again
        if (existing.mode === 'shared' && mode === 'shared') {
          existing.count++;
          return { status: 'granted' };
        }
        // Upgrade request: holds S, requesting X
        const otherHolders = [...rHolders.entries()].filter(([id]) => id !== txId);
        if (otherHolders.length === 0) {
          // Sole holder — upgrade immediately, count unchanged
          existing.mode = 'exclusive';
          return { status: 'granted' };
        }
        // Other S holders exist — must wait or abort
        return applyWaitDieOrEnqueue(txId, resource, mode, rHolders);
      }

      // New lock request (not currently holding this resource)
      if (canGrant(rHolders, txId, mode)) {
        rHolders.set(txId, { mode, count: 1 });
        txResources.get(txId)!.add(resource);
        return { status: 'granted' };
      }

      // Conflict with existing holder(s)
      return applyWaitDieOrEnqueue(txId, resource, mode, rHolders);
    },

    release(txId: string, resource: string): void {
      if (!txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} does not exist`);
      }
      const rHolders = holdersMap.get(resource);
      const holder = rHolders?.get(txId);
      if (!rHolders || !holder) {
        throw new LockError(`Transaction ${txId} does not hold a lock on ${resource}`);
      }

      holder.count--;
      if (holder.count <= 0) {
        rHolders.delete(txId);
        txResources.get(txId)?.delete(resource);
        grantWaiters(resource);
      }
    },

    downgrade(txId: string, resource: string): void {
      if (!txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} does not exist`);
      }
      const rHolders = holdersMap.get(resource);
      const holder = rHolders?.get(txId);
      if (!rHolders || !holder) {
        throw new LockError(`Transaction ${txId} does not hold a lock on ${resource}`);
      }
      if (holder.mode !== 'exclusive') {
        throw new LockError(`Transaction ${txId} does not hold an exclusive lock on ${resource}`);
      }

      holder.mode = 'shared';
      // After downgrade, pending shared waiters may now be grantable
      grantWaiters(resource);
    },

    commitTransaction(txId: string): void {
      if (!txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} does not exist`);
      }
      releaseAll(txId);
    },

    getHolders(resource: string): LockHolder[] {
      const rHolders = holdersMap.get(resource);
      if (!rHolders) return [];
      return [...rHolders.entries()].map(([txId, h]) => ({
        txId,
        mode: h.mode,
        count: h.count,
      }));
    },

    getWaiters(resource: string): LockWaiter[] {
      const rWaiters = waitersMap.get(resource);
      if (!rWaiters) return [];
      return rWaiters.map(w => ({ txId: w.txId, mode: w.mode }));
    },

    detectDeadlock(): string[] | null {
      // When wait-die is enabled, deadlocks cannot occur by design
      if (useWaitDie) return null;

      // Build wait-for graph: edge txA → txB means txA is waiting for txB
      const waitFor = new Map<string, Set<string>>();
      for (const txId of txSeqs.keys()) {
        waitFor.set(txId, new Set());
      }

      for (const [txId, resource] of txWaitingFor) {
        const rHolders = holdersMap.get(resource);
        if (!rHolders) continue;
        const edges = waitFor.get(txId);
        if (!edges) continue;
        for (const holderId of rHolders.keys()) {
          if (holderId !== txId) {
            edges.add(holderId);
          }
        }
      }

      // DFS-based cycle detection
      const visited = new Set<string>();
      const inStack = new Set<string>();
      const path: string[] = [];

      function dfs(node: string): string[] | null {
        visited.add(node);
        inStack.add(node);
        path.push(node);

        const neighbors = waitFor.get(node) ?? new Set<string>();
        for (const neighbor of neighbors) {
          if (inStack.has(neighbor)) {
            // Found a cycle — extract it
            const cycleStart = path.indexOf(neighbor);
            return [...path.slice(cycleStart), neighbor];
          }
          if (!visited.has(neighbor)) {
            const result = dfs(neighbor);
            if (result) return result;
          }
        }

        inStack.delete(node);
        path.pop();
        return null;
      }

      for (const txId of txSeqs.keys()) {
        if (!visited.has(txId)) {
          const cycle = dfs(txId);
          if (cycle) return cycle;
        }
      }

      return null;
    },

    getTransactionLocks(txId: string): TransactionLock[] {
      if (!txSeqs.has(txId)) {
        throw new LockError(`Transaction ${txId} does not exist`);
      }
      const resources = txResources.get(txId);
      if (!resources) return [];

      const result: TransactionLock[] = [];
      for (const resource of resources) {
        const holder = holdersMap.get(resource)?.get(txId);
        if (holder) {
          result.push({ resource, mode: holder.mode, count: holder.count });
        }
      }
      return result;
    },
  };
}