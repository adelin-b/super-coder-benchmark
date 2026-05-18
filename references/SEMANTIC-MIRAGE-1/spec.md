# SEMANTIC-MIRAGE-1: Effect-TS Resilient HTTP Client

## Overview
Implement a small HTTP client built on `effect` (v3) that:
- Wraps a fetch-like function as an `Effect`
- Has typed errors (`NetworkError`, `RateLimitError`, `ServerError`)
- Retries server errors with exponential backoff (max 3 attempts)
- Surfaces rate limits via the error channel (no retry)
- Uses a `Clock` service (Effect's built-in) for delays so tests are deterministic

This task targets the **Effect-TS semantic-mirage** patterns (E1–E6 in `docs/MIRAGE-TAXONOMY.md`). Correct vocabulary is not enough — the tests exercise runtime behavior.

## Exported API

```ts
import { Effect, Data, Schedule } from 'effect';

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly cause: unknown;
}> {}

export class RateLimitError extends Data.TaggedError('RateLimitError')<{
  readonly retryAfterMs: number;
}> {}

export class ServerError extends Data.TaggedError('ServerError')<{
  readonly status: number;
}> {}

export type HttpError = NetworkError | RateLimitError | ServerError;

/** Minimal response object the fetcher must return. */
export interface Response {
  status: number;
  text: () => Promise<string>;
  headers: Record<string, string>;
}

/** Fetcher injected by the caller. Pure shape, no DOM dep. */
export type Fetcher = (url: string) => Promise<Response>;

/**
 * Build a resilient GET-text function.
 *  - On 2xx: succeeds with response body text.
 *  - On 429: fails with RateLimitError(retryAfterMs from `retry-after` header in seconds*1000, default 1000). No retry.
 *  - On 5xx: fails with ServerError(status), retried with exponential backoff (50ms, 100ms, 200ms) up to 3 attempts total. If all retries exhausted, fails with the last ServerError.
 *  - On thrown Promise (network failure): NetworkError. No retry.
 *  - On 4xx other than 429: ServerError(status). No retry.
 */
export function makeClient(fetcher: Fetcher): {
  /** Returns an Effect that yields body text or fails with HttpError. */
  getText(url: string): Effect.Effect<string, HttpError>;
};
```

## Detailed requirements

### Wrapping the fetcher
- `fetcher(url)` returns `Promise<Response>` or rejects.
- Reject → `NetworkError`. The user-facing `Effect` must fail in the `E` channel, **not** throw.
- Resolve → inspect `status`.

### Status handling
| Status | Behavior |
|--------|----------|
| 200–299 | success, yield `await response.text()` |
| 429 | parse `retry-after` (seconds, integer string). If missing, use 1000 ms. Fail with `RateLimitError({ retryAfterMs })`. **No retry.** |
| 500–599 | Fail with `ServerError({ status })`. Retry policy: 50 ms, then 100 ms, then 200 ms (3 attempts total — initial + 2 retries). After exhaustion, fail with the last `ServerError`. |
| 400–499 (not 429) | `ServerError({ status })`. **No retry.** |

### Retries
- Use `Effect.retry` with `Schedule`. Only retry `ServerError` instances (i.e., not RateLimit, not Network).
- Backoff durations must use the Effect Clock so tests can use `TestClock` if desired.

### Edge cases
- `text()` itself may throw → treat as `NetworkError` (the body was unreadable).
- If `headers['retry-after']` is non-numeric, default to 1000 ms.
- The `Effect` must NOT throw synchronously when constructed. All errors live in the error channel.

## Invariants

1. `getText` returns an Effect; calling it never throws synchronously.
2. The `E` channel is exactly `NetworkError | RateLimitError | ServerError`.
3. Successful runs do not retry.
4. 5xx is retried at most twice (3 total attempts).
5. 429 is never retried — propagates immediately.
6. All async waits go through `Effect`/`Clock`, not raw `setTimeout` in the body (so the test runner can drive deterministic timing).

## Why this is a mirage-rich task
- E1 footgun: writing `const r = await fetcher(url)` inside `Effect.gen` breaks the whole abstraction.
- E2 footgun: `Effect.tryPromise({ try, catch: (e) => new Error(...) })` loses `_tag`, breaking the per-error retry rule.
- E3 footgun: `Effect.succeed(fetcher(url))` instead of `Effect.tryPromise`.
- E6 footgun: `Effect.map` instead of `Effect.flatMap` when the function returns another Effect (e.g., reading the body).
- M3 footgun: forgetting to wrap retry policy in `Schedule.intersect(Schedule.recurs(N))`, leading to infinite retries.
