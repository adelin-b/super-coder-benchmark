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
    this.name = 'RateLimitError';
  }
}

export function createSlidingWindowLimiter(policy: Policy) {
  // Validate policy
  if (policy.windowMax < 1) {
    throw new RateLimitError('windowMax must be >= 1');
  }
  if (policy.windowMs <= 0) {
    throw new RateLimitError('windowMs must be > 0');
  }
  if (policy.burstCapacity < 1) {
    throw new RateLimitError('burstCapacity must be >= 1');
  }
  if (policy.refillPerSec <= 0) {
    throw new RateLimitError('refillPerSec must be > 0');
  }

  interface KeyState {
    bucketTokens: number;
    lastRefillMs: number;
    windowLog: number[];
  }

  const state = new Map<string, KeyState>();

  function getOrCreateState(key: string, nowMs: number): KeyState {
    if (!state.has(key)) {
      state.set(key, {
        bucketTokens: policy.burstCapacity,
        lastRefillMs: nowMs,
        windowLog: [],
      });
    }
    return state.get(key)!;
  }

  function refillTokens(keyState: KeyState, nowMs: number): void {
    // Clamp to not go backwards in case of clock skew
    const clampedNowMs = Math.max(nowMs, keyState.lastRefillMs);
    const elapsed = clampedNowMs - keyState.lastRefillMs;
    const tokensToAdd = (elapsed / 1000) * policy.refillPerSec;
    keyState.bucketTokens = Math.min(
      policy.burstCapacity,
      keyState.bucketTokens + tokensToAdd
    );
    keyState.lastRefillMs = clampedNowMs;
  }

  function pruneWindow(keyState: KeyState, nowMs: number): void {
    const cutoff = nowMs - policy.windowMs;
    keyState.windowLog = keyState.windowLog.filter((t) => t > cutoff);
  }

  function check(key: string, nowMs: number): RateLimitResult {
    const keyState = getOrCreateState(key, nowMs);

    refillTokens(keyState, nowMs);
    pruneWindow(keyState, nowMs);

    const hasTokens = keyState.bucketTokens >= 1;
    const hasWindowCapacity = keyState.windowLog.length < policy.windowMax;

    if (hasTokens && hasWindowCapacity) {
      // Allowed: consume 1 token and record timestamp
      keyState.bucketTokens -= 1;
      keyState.windowLog.push(nowMs);
      return {
        allowed: true,
        tokensRemaining: Math.floor(keyState.bucketTokens),
        windowRemaining: policy.windowMax - keyState.windowLog.length,
        retryAfterMs: 0,
      };
    }

    // Denied: calculate retryAfterMs
    let retryAfterMs = 0;

    if (!hasTokens) {
      // Time until 1 token is refilled
      retryAfterMs = Math.ceil((1 / policy.refillPerSec) * 1000);
    }

    if (!hasWindowCapacity) {
      // Time until oldest entry in window expires
      const oldestMs = keyState.windowLog[0];
      const timeUntilExpiry = oldestMs + policy.windowMs - nowMs;
      retryAfterMs = Math.max(retryAfterMs, timeUntilExpiry);
    }

    return {
      allowed: false,
      tokensRemaining: Math.floor(keyState.bucketTokens),
      windowRemaining: policy.windowMax - keyState.windowLog.length,
      retryAfterMs: Math.max(1, Math.ceil(retryAfterMs)),
    };
  }

  function reset(key: string): void {
    state.delete(key);
  }

  function inspect(key: string, nowMs: number) {
    if (!state.has(key)) {
      return {
        bucketTokens: policy.burstCapacity,
        windowRequestCount: 0,
        oldestRequestMs: null,
      };
    }

    const keyState = state.get(key)!;
    refillTokens(keyState, nowMs);
    pruneWindow(keyState, nowMs);

    return {
      bucketTokens: Math.floor(keyState.bucketTokens),
      windowRequestCount: keyState.windowLog.length,
      oldestRequestMs: keyState.windowLog.length > 0 ? keyState.windowLog[0] : null,
    };
  }

  return { check, reset, inspect };
}