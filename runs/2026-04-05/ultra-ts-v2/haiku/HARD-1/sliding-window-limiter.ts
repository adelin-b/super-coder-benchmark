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

export class RateLimitError extends Error {}

export function createSlidingWindowLimiter(policy: Policy) {
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

  const states = new Map<string, KeyState>();

  function getState(key: string, nowMs: number): KeyState {
    if (!states.has(key)) {
      states.set(key, {
        bucketTokens: policy.burstCapacity,
        lastRefillMs: nowMs,
        windowLog: []
      });
    }
    return states.get(key)!;
  }

  function check(key: string, nowMs: number): RateLimitResult {
    const state = getState(key, nowMs);

    if (nowMs < state.lastRefillMs) {
      nowMs = state.lastRefillMs;
    }

    const elapsedMs = nowMs - state.lastRefillMs;
    const tokensToAdd = (elapsedMs / 1000) * policy.refillPerSec;
    state.bucketTokens = Math.min(
      policy.burstCapacity,
      state.bucketTokens + tokensToAdd
    );
    state.lastRefillMs = nowMs;

    const windowStart = nowMs - policy.windowMs;
    state.windowLog = state.windowLog.filter(ts => ts > windowStart);

    const hasTokens = state.bucketTokens >= 1;
    const hasWindow = state.windowLog.length < policy.windowMax;
    const allowed = hasTokens && hasWindow;

    let retryAfterMs = 0;

    if (!allowed) {
      let bucketRetryMs = 0;
      let windowRetryMs = 0;

      if (!hasTokens) {
        const tokensNeeded = 1 - state.bucketTokens;
        bucketRetryMs = Math.ceil(
          (tokensNeeded / policy.refillPerSec) * 1000
        );
      }

      if (!hasWindow && state.windowLog.length > 0) {
        const oldestTs = state.windowLog[0];
        windowRetryMs = oldestTs + policy.windowMs - nowMs;
      }

      retryAfterMs = Math.max(bucketRetryMs, windowRetryMs);
    }

    if (allowed) {
      state.bucketTokens -= 1;
      state.windowLog.push(nowMs);
    }

    return {
      allowed,
      tokensRemaining: state.bucketTokens,
      windowRemaining: policy.windowMax - state.windowLog.length,
      retryAfterMs
    };
  }

  function reset(key: string): void {
    states.delete(key);
  }

  function inspect(key: string, nowMs: number) {
    if (!states.has(key)) {
      return {
        bucketTokens: policy.burstCapacity,
        windowRequestCount: 0,
        oldestRequestMs: null
      };
    }

    const state = states.get(key)!;

    let currentNowMs = nowMs;
    if (currentNowMs < state.lastRefillMs) {
      currentNowMs = state.lastRefillMs;
    }

    const elapsedMs = currentNowMs - state.lastRefillMs;
    const tokensToAdd = (elapsedMs / 1000) * policy.refillPerSec;
    const bucketTokens = Math.min(
      policy.burstCapacity,
      state.bucketTokens + tokensToAdd
    );

    const windowStart = currentNowMs - policy.windowMs;
    const windowLog = state.windowLog.filter(ts => ts > windowStart);

    return {
      bucketTokens,
      windowRequestCount: windowLog.length,
      oldestRequestMs: windowLog.length > 0 ? windowLog[0] : null
    };
  }

  return { check, reset, inspect };
}