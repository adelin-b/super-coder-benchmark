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
  }
}

interface InternalHolder {
  txId: string;
  mode: LockMode;
  count: number;
}

interface InternalWaiter {
  txId: string;
  mode: LockMode;
}

interface ResourceState {
  holders: InternalHolder[];
  waiters: InternalWaiter[];
}

interface TransactionState {
  seq: number;
  active: boolean;
}

export function createLockManager(config?: { useWaitDie?: boolean }) {
  const useWaitDie = config?.useWaitDie ?? true;
  let nextSeq = 0;

  const transactions = new Map<string, TransactionState>();
  const resources = new Map<string, ResourceState>();

  function getResource(resource: string): ResourceState {
    let rs = resources.get(resource);
    if (!rs) {
      rs = { holders: [], waiters: [] };
      resources.set(resource, rs);
    }
    return rs;
  }

  function assertTxExists(txId: string): TransactionState {
    const tx = transactions.get(txId);
    if (!tx || !tx.active) {
      throw new LockError(`Transaction ${txId} does not exist`);
    }
    return tx;
  }

  function findHolder(rs: ResourceState, txId: string): InternalHolder | undefined {
    return rs.holders.find(h => h.txId === txId);
  }

  function removeHolder(rs: ResourceState, txId: string): InternalHolder | undefined {
    const idx = rs.holders.findIndex(h => h.txId === txId);
    if (idx === -1) return undefined;
    return rs.holders.splice(idx, 1)[0];
  }

  function removeWaiter(rs: ResourceState, txId: string): void {
    const idx = rs.waiters.findIndex(w => w.txId === txId);
    if (idx !== -1) rs.waiters.splice(idx, 1);
  }

  function grantWaiters(rs: ResourceState): void {
    if (rs.waiters.length === 0) return;

    // Keep granting while we can
    let granted = true;
    while (granted && rs.waiters.length > 0) {
      granted = false;
      const first = rs.waiters[0];

      if (first.mode === 'exclusive') {
        if (rs.holders.length === 0) {
          // No holders at all -> grant X
          rs.waiters.shift();
          rs.holders.push({ txId: first.txId, mode: 'exclusive', count: 1 });
          granted = true;
        } else if (
          rs.holders.length === 1 &&
          rs.holders[0].txId === first.txId &&
          rs.holders[0].mode === 'shared'
        ) {
          // Upgrade case: waiter is the sole S holder -> upgrade to X
          rs.waiters.shift();
          rs.holders[0].mode = 'exclusive';
          granted = true;
        }
        // If can't grant X, stop
        break;
      } else {
        // S waiter: grant if no exclusive holder
        const hasExclusive = rs.holders.some(h => h.mode === 'exclusive');
        if (hasExclusive) break;

        // Grant all consecutive S waiters
        while (rs.waiters.length > 0 && rs.waiters[0].mode === 'shared') {
          const sw = rs.waiters.shift()!;
          // Check if this tx already holds a shared lock (upgrade scenario that resolved)
          const existingHolder = findHolder(rs, sw.txId);
          if (existingHolder) {
            // This shouldn't normally happen for S waiters, but be safe
            existingHolder.count++;
          } else {
            rs.holders.push({ txId: sw.txId, mode: 'shared', count: 1 });
          }
          granted = true;
        }
      }
    }
  }

  // Release all locks for a transaction and grant waiters on affected resources
  function releaseAllLocks(txId: string): void {
    const affectedResources: string[] = [];

    for (const [resource, rs] of resources) {
      // Remove as holder
      const holder = removeHolder(rs, txId);
      if (holder) {
        affectedResources.push(resource);
      }
      // Remove as waiter
      removeWaiter(rs, txId);
    }

    // Grant waiters on affected resources
    for (const resource of affectedResources) {
      const rs = resources.get(resource);
      if (rs) {
        grantWaiters(rs);
      }
    }
  }

  return {
    beginTransaction(txId: string): void {
      if (transactions.has(txId) && transactions.get(txId)!.active) {
        throw new LockError(`Transaction ${txId} already exists`);
      }
      transactions.set(txId, { seq: nextSeq++, active: true });
    },

    acquire(txId: string, resource: string, mode: LockMode): AcquireResult {
      const tx = assertTxExists(txId);
      const rs = getResource(resource);
      const existingHolder = findHolder(rs, txId);

      // Re-entrant: already hold the same or higher mode
      if (existingHolder) {
        if (existingHolder.mode === 'exclusive') {
          // Already hold X, re-entrant regardless of requested mode
          existingHolder.count++;
          return { status: 'granted' };
        }
        if (existingHolder.mode === 'shared' && mode === 'shared') {
          // Already hold S, requesting S again
          existingHolder.count++;
          return { status: 'granted' };
        }
        // Hold S, requesting X -> upgrade
        if (existingHolder.mode === 'shared' && mode === 'exclusive') {
          // Check if sole shared holder
          const otherSharedHolders = rs.holders.filter(
            h => h.txId !== txId && h.mode === 'shared'
          );
          if (otherSharedHolders.length === 0) {
            // Sole S holder -> upgrade immediately
            existingHolder.mode = 'exclusive';
            return { status: 'granted' };
          }
          // Other shared holders exist -> conflict
          if (useWaitDie) {
            // Check wait-die: requester vs all other holders
            const isOlderThanAll = otherSharedHolders.every(h => {
              const holderTx = transactions.get(h.txId);
              return holderTx && tx.seq < holderTx.seq;
            });
            if (isOlderThanAll) {
              // Older -> wait (add to wait queue for upgrade)
              rs.waiters.push({ txId, mode: 'exclusive' });
              return { status: 'waiting' };
            } else {
              // Younger -> abort
              releaseAllLocks(txId);
              transactions.get(txId)!.active = false;
              return { status: 'aborted' };
            }
          } else {
            // No wait-die: just enqueue
            rs.waiters.push({ txId, mode: 'exclusive' });
            return { status: 'waiting' };
          }
        }
      }

      // Not currently holding this resource
      if (rs.holders.length === 0) {
        // Free resource
        rs.holders.push({ txId, mode, count: 1 });
        return { status: 'granted' };
      }

      // Check compatibility
      if (mode === 'shared') {
        const hasExclusive = rs.holders.some(h => h.mode === 'exclusive');
        if (!hasExclusive) {
          // All holders are shared, compatible
          rs.holders.push({ txId, mode: 'shared', count: 1 });
          return { status: 'granted' };
        }
      }

      // Conflict: either requesting X on held resource, or requesting S on X-held resource
      if (useWaitDie) {
        const isOlderThanAll = rs.holders.every(h => {
          const holderTx = transactions.get(h.txId);
          return holderTx && tx.seq < holderTx.seq;
        });

        if (isOlderThanAll) {
          rs.waiters.push({ txId, mode });
          return { status: 'waiting' };
        } else {
          // Younger -> abort
          releaseAllLocks(txId);
          transactions.get(txId)!.active = false;
          return { status: 'aborted' };
        }
      } else {
        // No wait-die: just enqueue
        rs.waiters.push({ txId, mode });
        return { status: 'waiting' };
      }
    },

    release(txId: string, resource: string): void {
      assertTxExists(txId);
      const rs = resources.get(resource);
      const holder = rs ? findHolder(rs, txId) : undefined;
      if (!holder) {
        throw new LockError(`Transaction ${txId} does not hold lock on ${resource}`);
      }

      holder.count--;
      if (holder.count <= 0) {
        removeHolder(rs!, txId);
        grantWaiters(rs!);
      }
    },

    downgrade(txId: string, resource: string): void {
      assertTxExists(txId);
      const rs = resources.get(resource);
      const holder = rs ? findHolder(rs, txId) : undefined;
      if (!holder) {
        throw new LockError(`Transaction ${txId} does not hold lock on ${resource}`);
      }
      if (holder.mode !== 'exclusive') {
        throw new LockError(`Transaction ${txId} does not hold exclusive lock on ${resource}`);
      }

      holder.mode = 'shared';
      // After downgrade, grant pending S waiters
      grantWaiters(rs!);
    },

    commitTransaction(txId: string): void {
      assertTxExists(txId);
      releaseAllLocks(txId);
      transactions.get(txId)!.active = false;
    },

    getHolders(resource: string): LockHolder[] {
      const rs = resources.get(resource);
      if (!rs) return [];
      return rs.holders.map(h => ({ txId: h.txId, mode: h.mode, count: h.count }));
    },

    getWaiters(resource: string): LockWaiter[] {
      const rs = resources.get(resource);
      if (!rs) return [];
      return rs.waiters.map(w => ({ txId: w.txId, mode: w.mode }));
    },

    detectDeadlock(): string[] | null {
      if (useWaitDie) return null;

      // Build wait-for graph: tx -> set of txs it waits for
      const waitFor = new Map<string, Set<string>>();

      for (const rs of resources.values()) {
        for (const waiter of rs.waiters) {
          if (!waitFor.has(waiter.txId)) {
            waitFor.set(waiter.txId, new Set<string>());
          }
          for (const holder of rs.holders) {
            if (holder.txId !== waiter.txId) {
              waitFor.get(waiter.txId)!.add(holder.txId);
            }
          }
        }
      }

      // DFS cycle detection
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = new Map<string, number>();
      const parent = new Map<string, string | null>();

      // Initialize all nodes in the graph
      const allNodes = new Set<string>();
      for (const [from, tos] of waitFor) {
        allNodes.add(from);
        for (const to of tos) allNodes.add(to);
      }
      for (const node of allNodes) color.set(node, WHITE);

      for (const startNode of allNodes) {
        if (color.get(startNode) !== WHITE) continue;

        const stack: { id: string; neighbors: string[]; idx: number }[] = [];
        const neighbors = waitFor.has(startNode) ? [...waitFor.get(startNode)!] : [];
        stack.push({ id: startNode, neighbors, idx: 0 });
        color.set(startNode, GRAY);
        parent.set(startNode, null);

        while (stack.length > 0) {
          const frame = stack[stack.length - 1];

          if (frame.idx < frame.neighbors.length) {
            const neighbor = frame.neighbors[frame.idx];
            frame.idx++;

            const c = color.get(neighbor)!;
            if (c === GRAY) {
              // Found cycle
              const cycle: string[] = [neighbor];
              let cur = frame.id;
              while (cur !== neighbor) {
                cycle.push(cur);
                cur = parent.get(cur)!;
              }
              cycle.push(neighbor);
              cycle.reverse();
              return cycle;
            } else if (c === WHITE) {
              color.set(neighbor, GRAY);
              parent.set(neighbor, frame.id);
              const nextNeighbors = waitFor.has(neighbor) ? [...waitFor.get(neighbor)!] : [];
              stack.push({ id: neighbor, neighbors: nextNeighbors, idx: 0 });
            }
          } else {
            color.set(frame.id, BLACK);
            stack.pop();
          }
        }
      }

      return null;
    },

    getTransactionLocks(txId: string): TransactionLock[] {
      assertTxExists(txId);
      const result: TransactionLock[] = [];
      for (const [resource, rs] of resources) {
        const holder = findHolder(rs, txId);
        if (holder) {
          result.push({ resource, mode: holder.mode, count: holder.count });
        }
      }
      return result;
    },
  };
}
