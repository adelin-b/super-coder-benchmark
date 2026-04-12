import { Effect, Data, Exit, Cause } from "effect"

// ─── Public Types ────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Tokens added per interval (refill rate) */
  tokensPerInterval: number
  /** Sliding window interval in milliseconds */
  intervalMs: number
  /** Maximum tokens the bucket can hold (burst capacity) */
  burstCapacity: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export interface UserStatus {
  tokens: number
  capacity: number
  refillRate: number
}

export interface RateLimiter {
  /**
   * Attempt to consume `tokens` (default 1) for `userId`.
   * Returns RateLimitResult on success.
   * Throws RateLimitError if the bucket has insufficient tokens.
   */
  consume(userId: string, tokens?: number): RateLimitResult
  /**
   * Try to consume without throwing — always returns a result.
   * `result.allowed` will be false if the bucket is exhausted.
   */
  tryConsume(userId: string, tokens?: number): RateLimitResult
  /** Current bucket status for a user (non-destructive). */
  getStatus(userId: string): UserStatus
  /** Reset a single user's bucket to full capacity. */
  reset(userId: string): void
  /** Reset all user buckets. */
  resetAll(): void
}

// ─── Public Error ─────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  readonly userId: string
  readonly retryAfterMs: number
  readonly remaining: number

  constructor(userId: string, retryAfterMs: number, remaining: number, message?: string) {
    super(
      message ??
        `Rate limit exceeded for "${userId}". ${remaining} tokens available. Retry after ${retryAfterMs}ms.`
    )
    this.name = "RateLimitError"
    this.userId = userId
    this.retryAfterMs = retryAfterMs
    this.remaining = remaining
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

// ─── Internal Effect Layer ────────────────────────────────────────────────────

class TokensExhausted extends Data.TaggedError("TokensExhausted")<{
  userId: string
  available: number
  requested: number
  retryAfterMs: number
}> {}

class InvalidInput extends Data.TaggedError("InvalidInput")<{ reason: string }> {}

interface BucketState {
  tokens: number
  lastRefillAt: number
}

// ─── Domain Invariants ────────────────────────────────────────────────────────
// ∀ valid bucket state: 0 ≤ tokens ≤ burstCapacity
// ∀ consume(n): remaining = prior_tokens − n, where remaining ≥ 0
// ∀ elapsed ≥ 0: refilled = min(burstCapacity, prior + elapsed/intervalMs * tokensPerInterval)

function computeRefilled(state: BucketState, cfg: RateLimiterConfig, now: number): number {
  const elapsed = Math.max(0, now - state.lastRefillAt)
  const added = (elapsed / cfg.intervalMs) * cfg.tokensPerInterval
  return Math.min(cfg.burstCapacity, state.tokens + added)
}

function makeConsumeEffect(
  buckets: Map<string, BucketState>,
  cfg: RateLimiterConfig,
  userId: string,
  requested: number,
  now: number
): Effect.Effect<RateLimitResult, TokensExhausted | InvalidInput> {
  return Effect.gen(function* () {
    if (!userId || userId.trim() === "") {
      yield* Effect.fail(new InvalidInput({ reason: "userId must be a non-empty string" }))
    }
    if (requested <= 0) {
      yield* Effect.fail(new InvalidInput({ reason: "tokens must be a positive number" }))
    }
    if (requested > cfg.burstCapacity) {
      yield* Effect.fail(
        new InvalidInput({
          reason: `Requested tokens (${requested}) exceed burstCapacity (${cfg.burstCapacity})`,
        })
      )
    }

    const existing = buckets.get(userId)
    const stateNow: BucketState = existing ?? { tokens: cfg.burstCapacity, lastRefillAt: now }
    const available = computeRefilled(stateNow, cfg, now)

    if (available < requested) {
      const deficit = requested - available
      const retryAfterMs = Math.ceil((deficit / cfg.tokensPerInterval) * cfg.intervalMs)
      yield* Effect.fail(
        new TokensExhausted({
          userId,
          available,
          requested,
          retryAfterMs,
        })
      )
    }

    const remaining = available - requested
    // Clamp to invariant bounds
    const clamped = Math.max(0, Math.min(cfg.burstCapacity, remaining))
    buckets.set(userId, { tokens: clamped, lastRefillAt: now })

    return {
      allowed: true,
      remaining: Math.floor(clamped),
      retryAfterMs: 0,
    } satisfies RateLimitResult
  })
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  // Eager validation
  if (config.tokensPerInterval <= 0)
    throw new Error("tokensPerInterval must be positive")
  if (config.intervalMs <= 0)
    throw new Error("intervalMs must be positive")
  if (config.burstCapacity <= 0)
    throw new Error("burstCapacity must be positive")

  const buckets = new Map<string, BucketState>()

  function runConsume(
    userId: string,
    tokens: number,
    throwOnFail: true
  ): RateLimitResult
  function runConsume(
    userId: string,
    tokens: number,
    throwOnFail: false
  ): RateLimitResult
  function runConsume(userId: string, tokens: number, throwOnFail: boolean): RateLimitResult {
    const now = Date.now()
    const eff = makeConsumeEffect(buckets, config, userId, tokens, now)
    const exit = Effect.runSyncExit(eff)

    if (Exit.isSuccess(exit)) {
      return exit.value
    }

    const raw = Cause.squash(exit.cause)

    if (raw instanceof InvalidInput) {
      throw new Error(raw.reason)
    }

    if (raw instanceof TokensExhausted) {
      if (throwOnFail) {
        throw new RateLimitError(
          raw.userId,
          raw.retryAfterMs,
          Math.floor(raw.available)
        )
      }
      return {
        allowed: false,
        remaining: Math.floor(raw.available),
        retryAfterMs: raw.retryAfterMs,
      }
    }

    // Unexpected defect — re-throw as-is
    if (raw instanceof Error) throw raw
    throw new Error(String(raw))
  }

  return {
    consume(userId: string, tokens = 1): RateLimitResult {
      return runConsume(userId, tokens, true)
    },

    tryConsume(userId: string, tokens = 1): RateLimitResult {
      return runConsume(userId, tokens, false)
    },

    getStatus(userId: string): UserStatus {
      if (!userId || userId.trim() === "") throw new Error("userId must be a non-empty string")
      const now = Date.now()
      const existing = buckets.get(userId)
      const state: BucketState = existing ?? { tokens: config.burstCapacity, lastRefillAt: now }
      const refilled = computeRefilled(state, config, now)
      const clamped = Math.max(0, Math.min(config.burstCapacity, refilled))
      return {
        tokens: Math.floor(clamped),
        capacity: config.burstCapacity,
        refillRate: config.tokensPerInterval / config.intervalMs,
      }
    },

    reset(userId: string): void {
      if (!userId || userId.trim() === "") throw new Error("userId must be a non-empty string")
      buckets.delete(userId)
    },

    resetAll(): void {
      buckets.clear()
    },
  }
}