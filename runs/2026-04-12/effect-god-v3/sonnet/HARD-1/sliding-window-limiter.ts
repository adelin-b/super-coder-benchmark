export interface Policy {
  windowMax: number;
  windowMs: number;
  burstCapacity: number;
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  windowRemaining: number;
  retryAfterMs: number;
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

interface KeyState {
  tokens: number;
  lastRefillMs: number | null;
  windowLog: number[];
}

export function createSlidingWindowLimiter(policy: Policy): {
  check(key: string, nowMs: number): RateLimitResult;
  reset(key: string): void;
  inspect(
    key: string,
    nowMs: number
  ): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  };
} {
  if (policy.windowMax < 1)
    throw new RateLimitError("windowMax must be >= 1");
  if (policy.windowMs <= 0)
    throw new RateLimitError("windowMs must be > 0");
  if (policy.burstCapacity < 1)
    throw new RateLimitError("burstCapacity must be >= 1");
  if (policy.refillPerSec <= 0)
    throw new RateLimitError("refillPerSec must be > 0");

  const store = new Map<string, KeyState>();

  function getOrCreate(key: string): KeyState {
    if (!store.has(key)) {
      store.set(key, {
        tokens: policy.burstCapacity,
        lastRefillMs: null,
        windowLog: [],
      });
    }
    return store.get(key)!;
  }

  /** Clamp nowMs to prevent clock skew from going backwards */
  function clampNow(state: KeyState, nowMs: number): number {
    if (state.lastRefillMs === null) return nowMs;
    return Math.max(nowMs, state.lastRefillMs);
  }

  /** Refill tokens based on elapsed time; mutates state */
  function refill(state: KeyState, effectiveNow: number): void {
    if (state.lastRefillMs === null) {
      state.lastRefillMs = effectiveNow;
      state.tokens = policy.burstCapacity;
      return;
    }
    const elapsed = (effectiveNow - state.lastRefillMs) / 1000;
    if (elapsed > 0) {
      state.tokens = Math.min(
        policy.burstCapacity,
        state.tokens + elapsed * policy.refillPerSec
      );
    }
    state.lastRefillMs = effectiveNow;
  }

  /** Remove window log entries that have fallen outside the window; mutates state */
  function pruneWindow(state: KeyState, effectiveNow: number): void {
    const cutoff = effectiveNow - policy.windowMs;
    let i = 0;
    while (i < state.windowLog.length && state.windowLog[i] <= cutoff) {
      i++;
    }
    if (i > 0) state.windowLog.splice(0, i);
  }

  return {
    check(key: string, nowMs: number): RateLimitResult {
      const state = getOrCreate(key);
      const effectiveNow = clampNow(state, nowMs);

      refill(state, effectiveNow);
      pruneWindow(state, effectiveNow);

      const windowCount = state.windowLog.length;
      const bucketOk = state.tokens >= 1;
      const windowOk = windowCount < policy.windowMax;

      if (bucketOk && windowOk) {
        state.tokens -= 1;
        state.windowLog.push(effectiveNow);
        return {
          allowed: true,
          tokensRemaining: state.tokens,
          windowRemaining: policy.windowMax - state.windowLog.length,
          retryAfterMs: 0,
        };
      }

      // Compute retryAfterMs — take the maximum of all applicable wait times
      let retryAfterMs = 0;

      if (!bucketOk) {
        // Time until token bucket reaches 1 token
        const tokensNeeded = 1 - state.tokens;
        const waitMs = (tokensNeeded / policy.refillPerSec) * 1000;
        retryAfterMs = Math.max(retryAfterMs, waitMs);
      }

      if (!windowOk) {
        // Oldest entry expires at oldest + windowMs; after pruning, oldest is strictly > cutoff
        const oldest = state.windowLog[0];
        const waitMs = oldest + policy.windowMs - effectiveNow;
        retryAfterMs = Math.max(retryAfterMs, waitMs);
      }

      // Guarantee invariant 4: retryAfterMs > 0 when denied
      if (retryAfterMs <= 0) retryAfterMs = 1;

      return {
        allowed: false,
        tokensRemaining: state.tokens,
        windowRemaining: Math.max(0, policy.windowMax - windowCount),
        retryAfterMs,
      };
    },

    reset(key: string): void {
      store.delete(key);
    },

    inspect(
      key: string,
      nowMs: number
    ): {
      bucketTokens: number;
      windowRequestCount: number;
      oldestRequestMs: number | null;
    } {
      if (!store.has(key)) {
        return {
          bucketTokens: policy.burstCapacity,
          windowRequestCount: 0,
          oldestRequestMs: null,
        };
      }

      const state = store.get(key)!;
      const effectiveNow = clampNow(state, nowMs);

      // Compute tokens without mutating
      let bucketTokens = state.tokens;
      if (state.lastRefillMs !== null && effectiveNow > state.lastRefillMs) {
        const elapsed = (effectiveNow - state.lastRefillMs) / 1000;
        bucketTokens = Math.min(
          policy.burstCapacity,
          bucketTokens + elapsed * policy.refillPerSec
        );
      }

      // Compute window entries without mutating
      const cutoff = effectiveNow - policy.windowMs;
      const windowEntries = state.windowLog.filter((t) => t > cutoff);

      return {
        bucketTokens,
        windowRequestCount: windowEntries.length,
        oldestRequestMs: windowEntries.length > 0 ? windowEntries[0] : null,
      };
    },
  };
}