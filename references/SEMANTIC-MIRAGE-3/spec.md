# SEMANTIC-MIRAGE-3: Token-Bucket Rate Limiter (Quint-spec'd → TS)

## Overview
Implement a **token-bucket rate limiter** in TypeScript whose temporal invariants are derivable from a Quint-style spec. The implementation must satisfy a set of property-based + scenario tests that exercise the same invariants a Quint model would check.

This task targets Quint-flavored semantic-mirage patterns (Q1–Q6 in `docs/MIRAGE-TAXONOMY.md`) **in TypeScript code**: the patterns transfer (mode/state confusion → mutation-vs-pure-computation mistakes, init-omits-var → field-default mistakes, action-drops-var → forgetting to update a field). The Quint reference spec (informational) is included as `bucket.qnt`.

## Exported API

```ts
export interface BucketState {
  readonly tokens: number;
  readonly lastRefillMs: number;
}

export interface BucketConfig {
  /** Bucket capacity (max tokens). */
  readonly capacity: number;
  /** Tokens added per second. */
  readonly refillRatePerSec: number;
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`rate limited, retry after ${retryAfterMs}ms`);
  }
}

/**
 * Pure refill computation: given a state and a clock time, return the new state.
 * Must NOT throw. Must NOT mutate inputs.
 */
export function refill(state: BucketState, nowMs: number, config: BucketConfig): BucketState;

/**
 * Pure consume computation. Returns either a new state (allowed) or a RateLimitedError with retryAfterMs (denied).
 * Must NOT mutate inputs.
 */
export function consume(
  state: BucketState,
  nowMs: number,
  config: BucketConfig,
  tokens: number,
): { ok: true; state: BucketState } | { ok: false; retryAfterMs: number };

/**
 * Convenience builder that owns mutable state internally.
 */
export function createBucket(config: BucketConfig, clock: { now: () => number }): {
  tryConsume(tokens: number): { allowed: true } | { allowed: false; retryAfterMs: number };
  snapshot(): BucketState;
};
```

## Detailed requirements

### Refill rule
- Tokens added between `state.lastRefillMs` and `nowMs` = `((nowMs - state.lastRefillMs) / 1000) * refillRatePerSec`.
- Cap at `capacity`.
- New `lastRefillMs` = `nowMs`.
- If `nowMs <= state.lastRefillMs`, return state unchanged (clock did not advance).

### Consume rule
- First refill, then check tokens.
- If `tokens` argument <= 0: throw `RangeError`.
- If `tokens > capacity`: returns `{ ok: false, retryAfterMs: Infinity }` (impossible request).
- If sufficient: subtract, return `{ ok: true, state: { tokens: post, lastRefillMs: nowMs } }`.
- If insufficient: compute the millis until enough tokens accumulate at the refill rate. Return `{ ok: false, retryAfterMs }`.

### Pure functions

`refill` and `consume` must be **referentially transparent**: same args → same result. Tests pass the same state/now twice and assert outputs are equal (deep equal). No `Date.now()` calls inside.

### Initial state

`createBucket` must initialize internal state with `tokens = capacity`, `lastRefillMs = clock.now()`. If implementation forgets to read clock.now() and defaults to 0, time-since-creation tests fail (Q5 analog).

## Invariants

1. **Cap**: tokens never exceed capacity.
2. **Non-negative**: tokens never < 0.
3. **Monotonic refill**: refilling with `now2 >= now1` then `now1` (in that order) does not increase tokens beyond what refill(now2) gave.
4. **Pure**: passing the same `(state, now, config)` to `refill` twice returns deep-equal values. Same for `consume`.
5. **Consume rejection accuracy**: when `ok: false`, the returned `retryAfterMs` is exactly the time at which a follow-up `consume(state, now + retryAfterMs, config, tokens)` would succeed (within ±1 ms tolerance).
6. **Idempotent refill**: `refill(refill(s, t, c), t, c) === refill(s, t, c)` (deep equal).
7. **No mutation**: passing a frozen state object to `refill`/`consume` must not throw.

## Why this is mirage-rich

- Q1 analog: an LLM writes `function refill(state, now, config) { state.tokens = ...; }` (mutating). Looks like a "value definition" body but actually a stateful update — same as Quint `val` referencing state.
- Q2 analog: a `consume` that branches on conditions but never assigns the result (forgets to construct the new state). The function returns the *old* state, like a Quint action without primed assignments.
- Q5 analog: `createBucket` that defaults `lastRefillMs = 0` instead of `clock.now()` — equivalent to Quint `init` not binding a variable. Invariant 5 (retryAfterMs accuracy) fails on first call.
- Q6 analog: an implementation of `consume` that updates `tokens` but forgets to also update `lastRefillMs` — the variable "drops out", just like Quint action that omits `lastRefillMs' = nowMs`. Invariant 6 (idempotent refill) fails.
- M3: copying refill formula but swapping `*` and `/` (per-second vs per-millisecond confusion). Type-checks, fails silently.

## Reference Quint spec (informational, not executed by tests)

See `bucket.qnt`. Use to design property tests, not as a compilation target.
