export interface BucketState {
  readonly tokens: number;
  readonly lastRefillMs: number;
}

export interface BucketConfig {
  readonly capacity: number;
  readonly refillRatePerSec: number;
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`rate limited, retry after ${retryAfterMs}ms`);
  }
}

function earnedTokens(deltaMs: number, ratePerSec: number): number {
  if (deltaMs <= 0) return 0;
  return (deltaMs / 1000) * ratePerSec;
}

export function refill(state: BucketState, nowMs: number, config: BucketConfig): BucketState {
  if (nowMs <= state.lastRefillMs) return state;
  const earned = earnedTokens(nowMs - state.lastRefillMs, config.refillRatePerSec);
  const refilled = Math.min(config.capacity, state.tokens + earned);
  return { tokens: refilled, lastRefillMs: nowMs };
}

export function consume(
  state: BucketState,
  nowMs: number,
  config: BucketConfig,
  tokens: number,
): { ok: true; state: BucketState } | { ok: false; retryAfterMs: number } {
  if (tokens <= 0) throw new RangeError('tokens must be positive');
  if (tokens > config.capacity) {
    return { ok: false, retryAfterMs: Number.POSITIVE_INFINITY };
  }
  const refilled = refill(state, nowMs, config);
  if (refilled.tokens >= tokens) {
    return {
      ok: true,
      state: { tokens: refilled.tokens - tokens, lastRefillMs: refilled.lastRefillMs },
    };
  }
  const missing = tokens - refilled.tokens;
  const retryAfterMs = Math.ceil((missing / config.refillRatePerSec) * 1000);
  return { ok: false, retryAfterMs };
}

export function createBucket(
  config: BucketConfig,
  clock: { now: () => number },
): {
  tryConsume(tokens: number): { allowed: true } | { allowed: false; retryAfterMs: number };
  snapshot(): BucketState;
} {
  let state: BucketState = { tokens: config.capacity, lastRefillMs: clock.now() };
  return {
    tryConsume(tokens: number) {
      const result = consume(state, clock.now(), config, tokens);
      if (result.ok) {
        state = result.state;
        return { allowed: true };
      }
      return { allowed: false, retryAfterMs: result.retryAfterMs };
    },
    snapshot() {
      return state;
    },
  };
}
