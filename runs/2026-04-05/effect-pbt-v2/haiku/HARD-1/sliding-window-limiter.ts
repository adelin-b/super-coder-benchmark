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
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export function createSlidingWindowLimiter(policy: Policy) {
  // Validate policy
  if (policy.windowMax < 1) {
    throw new RateLimitError("windowMax must be >= 1");
  }
  if (policy.windowMs <= 0) {
    throw new RateLimitError("windowMs must be > 0");
  }
  if (policy.burstCapacity < 1) {
    throw new RateLimitError("burstCapacity must be >= 1");
  }
  if (policy.refillPerSec <= 0) {
    throw new RateLimitError("refillPerSec must be > 0");
  }

  const state = new Map<
    string,
    {
      bucketTokens: number;
      lastRefillMs: number;
      windowLog: number[];
    }
  >();

  function check(key: string, nowMs: number): RateLimitResult {
    let entry = state.get(key);

    if (!entry) {
      entry = {
        bucketTokens: policy.burstCapacity,
        lastRefillMs: nowMs,
        windowLog: [],
      };
      state.set(key, entry);
    }

    // Handle clock skew: never go backwards in time
    const effectiveNowMs = Math.max(nowMs, entry.lastRefillMs);

    // Refill tokens based on elapsed time
    const elapsedMs = effectiveNowMs - entry.lastRefillMs;
    const elapsedSec = elapsedMs / 1000;
    const tokensToAdd = elapsedSec * policy.refillPerSec;
    const newBucketTokens = Math.min(
      policy.burstCapacity,
      entry.bucketTokens + tokensToAdd
    );

    // Prune window log (keep entries strictly after window start)
    const windowStartMs = effectiveNowMs - policy.windowMs;
    entry.windowLog = entry.windowLog.filter(
      (timestamp) => timestamp > windowStartMs
    );

    // Check if request is allowed
    const bucketAllows = newBucketTokens >= 1;
    const windowAllows = entry.windowLog.length < policy.windowMax;
    const allowed = bucketAllows && windowAllows;

    let retryAfterMs = 0;
    if (!allowed) {
      let bucketRetryMs = 0;
      let windowRetryMs = 0;

      if (!bucketAllows) {
        const tokensNeeded = 1 - newBucketTokens;
        const secToWait = tokensNeeded / policy.refillPerSec;
        bucketRetryMs = Math.ceil(secToWait * 1000);
      }

      if (!windowAllows && entry.windowLog.length > 0) {
        const oldestMs = entry.windowLog[0];
        const expiryMs = oldestMs + policy.windowMs;
        windowRetryMs = Math.ceil(Math.max(0, expiryMs - effectiveNowMs));
      }

      retryAfterMs = Math.max(bucketRetryMs, windowRetryMs);
    }

    // Update state
    entry.bucketTokens = newBucketTokens;
    entry.lastRefillMs = effectiveNowMs;
    if (allowed) {
      entry.bucketTokens -= 1;
      entry.windowLog.push(effectiveNowMs);
    }

    return {
      allowed,
      tokensRemaining: entry.bucketTokens,
      windowRemaining: Math.max(0, policy.windowMax - entry.windowLog.length),
      retryAfterMs,
    };
  }

  function reset(key: string): void {
    state.delete(key);
  }

  function inspect(
    key: string,
    nowMs: number
  ): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  } {
    const entry = state.get(key);

    if (!entry) {
      return {
        bucketTokens: policy.burstCapacity,
        windowRequestCount: 0,
        oldestRequestMs: null,
      };
    }

    // Calculate current tokens at the given time (without modifying state)
    const effectiveNowMs = Math.max(nowMs, entry.lastRefillMs);
    const elapsedSec = (effectiveNowMs - entry.lastRefillMs) / 1000;
    const tokensToAdd = elapsedSec * policy.refillPerSec;
    const bucketTokens = Math.min(
      policy.burstCapacity,
      entry.bucketTokens + tokensToAdd
    );

    // Prune window log (without modifying state)
    const windowStartMs = effectiveNowMs - policy.windowMs;
    const prunedLog = entry.windowLog.filter(
      (timestamp) => timestamp > windowStartMs
    );

    return {
      bucketTokens,
      windowRequestCount: prunedLog.length,
      oldestRequestMs: prunedLog.length > 0 ? prunedLog[0] : null,
    };
  }

  return { check, reset, inspect };
}