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

  // State per key
  const state = new Map<
    string,
    {
      bucketTokens: number;
      lastRefillMs: number;
      windowLog: number[];
    }
  >();

  const check = (key: string, nowMs: number): RateLimitResult => {
    // Ensure state exists
    if (!state.has(key)) {
      state.set(key, {
        bucketTokens: policy.burstCapacity,
        lastRefillMs: nowMs,
        windowLog: [],
      });
    }

    const s = state.get(key)!;

    // Handle clock skew: clamp to last seen time
    const effectiveNowMs = Math.max(nowMs, s.lastRefillMs);

    // Refill tokens based on elapsed time
    const elapsedSec = (effectiveNowMs - s.lastRefillMs) / 1000;
    const refillAmount = elapsedSec * policy.refillPerSec;
    s.bucketTokens = Math.min(
      policy.burstCapacity,
      s.bucketTokens + refillAmount
    );
    s.lastRefillMs = effectiveNowMs;

    // Prune old entries from window log
    const windowStart = effectiveNowMs - policy.windowMs;
    while (s.windowLog.length > 0 && s.windowLog[0] <= windowStart) {
      s.windowLog.shift();
    }

    // Check if allowed
    const bucketAllows = s.bucketTokens >= 1;
    const windowAllows = s.windowLog.length < policy.windowMax;
    const allowed = bucketAllows && windowAllows;

    // Calculate retryAfterMs
    let retryAfterMs = 0;
    if (!allowed) {
      let bucketRetryMs = 0;
      let windowRetryMs = 0;

      if (!bucketAllows) {
        // Time until we have at least 1 token
        const tokensNeeded = 1 - s.bucketTokens;
        const secondsNeeded = tokensNeeded / policy.refillPerSec;
        bucketRetryMs = Math