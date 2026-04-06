# HARD-1: Concurrent Sliding-Window Rate Limiter

## Overview
Implement a hybrid rate limiter that combines a **token bucket** for burst capacity with a **sliding window log** for precise per-second rate tracking. The limiter must handle interleaved concurrent access correctly, detect sustained bursts, and support multiple independent policies per key.

## Exported API

```ts
export interface Policy {
  /** Max requests in the sliding window */
  windowMax: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Token bucket capacity for bursts */
  burstCapacity: number;
  /** Token bucket refill rate (tokens per second) */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining in the bucket after this request */
  tokensRemaining: number;
  /** Requests remaining in the current window */
  windowRemaining: number;
  /** Milliseconds until next token is available (0 if allowed) */
  retryAfterMs: number;
}

export class RateLimitError extends Error {}

export function createSlidingWindowLimiter(policy: Policy): {
  /** Try to consume one request for the given key at the given timestamp (ms). */
  check(key: string, nowMs: number): RateLimitResult;
  /** Remove all state for a key. */
  reset(key: string): void;
  /** Return a snapshot of the internal state for a key (for debugging). */
  inspect(key: string, nowMs: number): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  };
};
```

## Detailed Requirements

### Token Bucket
- Each key starts with `burstCapacity` tokens.
- Tokens refill continuously at `refillPerSec` tokens per second, computed from elapsed time since last check.
- Tokens never exceed `burstCapacity`.
- Each allowed request consumes exactly 1 token.

### Sliding Window Log
- Maintain a log of timestamps for each allowed request per key.
- The window is `[nowMs - windowMs, nowMs]` inclusive on the right, exclusive on the left.
- Before checking, prune entries older than the window.
- A request is allowed only if the count of entries in the window is strictly less than `windowMax`.

### Combined Check Logic
A request is **allowed** only if BOTH:
1. The token bucket has >= 1 token, AND
2. The sliding window count < windowMax.

If allowed, consume a token AND record the timestamp. If denied, consume nothing.

### `retryAfterMs` Calculation
- If denied by the token bucket: compute time until next token refill.
- If denied by the sliding window: compute time until the oldest entry in the window expires.
- If denied by both: return the **maximum** of both wait times (the caller must wait for the stricter constraint).
- If allowed: return 0.

### Validation
- `windowMax` must be >= 1.
- `windowMs` must be > 0.
- `burstCapacity` must be >= 1.
- `refillPerSec` must be > 0.
- Throw `RateLimitError` on invalid policy.

### Edge Cases
- If `check` is called with the same `nowMs` multiple times, each call is a separate request.
- If `nowMs` goes backwards (clock skew), treat it as the same time as the last recorded timestamp (clamp to last seen time, never go backwards).
- After `reset`, the key behaves as if it was never seen (full capacity, empty window).
- Two different keys are completely independent.

## Invariants
1. `tokensRemaining` is always in `[0, burstCapacity]`.
2. `windowRemaining` is always in `[0, windowMax]`.
3. If `allowed` is true, `retryAfterMs` is 0.
4. If `allowed` is false, `retryAfterMs` is > 0.
5. After `reset(key)`, `inspect(key, anyTime)` returns `{ bucketTokens: burstCapacity, windowRequestCount: 0, oldestRequestMs: null }`.
