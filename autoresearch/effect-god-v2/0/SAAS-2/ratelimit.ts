import { Effect, Data, Exit, Cause } from "effect";

// ─── Internal tagged errors ───────────────────────────────────────────────────

class ConfigError extends Data.TaggedError("ConfigError")<{ reason: string }> {}

class BucketExhaustedError extends Data.TaggedError("BucketExhaustedError")<{
  userId: string;
  retryAfter: number;
  remaining: number;
}> {}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Peak burst capacity (defaults to maxRequests) */
  burstCapacity?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Whole tokens remaining in the bucket */
  remaining: number;
  /** Date at which the bucket will be completely full again */
  resetAt: Date;
  /** Milliseconds to wait before retrying (only present when allowed === false) */
  retryAfter?: number;
}

export interface UserStatus {
  userId: string;
  tokens: number;
  capacity: number;
  resetAt: Date;
}

export class RateLimitError extends Error {
  public readonly retryAfter: number;
  public readonly remaining: number;
  constructor(message: string, retryAfter: number, remaining: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.remaining = remaining;
  }
}

export interface RateLimiter {
  /**
   * Attempt to consume `tokens` (default 1) for `userId`.
   * Returns a RateLimitResult; never throws for rate-limit violations.
   */
  consume(userId: string, tokens?: number): RateLimitResult;
  /** Snapshot of the current bucket state (after applying elapsed refill). */
  getStatus(userId: string): UserStatus;
  /** Reset a single user's bucket to full capacity. */
  reset(userId: string): void;
  /** Reset every user's bucket. */
  resetAll(): void;
}

// ─── Internal bucket state ────────────────────────────────────────────────────

interface Bucket {
  /** Current fractional token count */
  tokens: number;
  /** Epoch ms of the last refill computation */
  lastRefill: number;
}

// ─── Internal Effect helpers ──────────────────────────────────────────────────

const validateConfig = (
  raw: RateLimiterConfig
): Effect.Effect<Required<RateLimiterConfig>, ConfigError> =>
  Effect.gen(function* () {
    if (!Number.isFinite(raw.windowMs) || raw.windowMs <= 0)
      yield* Effect.fail(new ConfigError({ reason: "windowMs must be a positive finite number" }));
    if (!Number.isFinite(raw.maxRequests) || raw.maxRequests <= 0)
      yield* Effect.fail(new ConfigError({ reason: "maxRequests must be a positive finite number" }));

    const burst = raw.burstCapacity ?? raw.maxRequests;
    if (burst < raw.maxRequests)
      yield* Effect.fail(
        new ConfigError({ reason: "burstCapacity must be >= maxRequests" })
      );

    return { windowMs: raw.windowMs, maxRequests: raw.maxRequests, burstCapacity: burst };
  });

/** Compute how many tokens have been added since lastRefill, capped at capacity. */
const applyRefill = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  now: number
): Bucket => {
  const elapsed = Math.max(0, now - bucket.lastRefill);
  const rate = cfg.maxRequests / cfg.windowMs; // tokens / ms
  const added = elapsed * rate;
  return {
    tokens: Math.min(bucket.tokens + added, cfg.burstCapacity),
    lastRefill: now,
  };
};

/** Milliseconds until the bucket is full from its current token level. */
const msToFull = (tokens: number, cfg: Required<RateLimiterConfig>): number => {
  const rate = cfg.maxRequests / cfg.windowMs;
  const deficit = cfg.burstCapacity - tokens;
  return deficit <= 0 ? 0 : deficit / rate;
};

const tryConsume = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  userId: string,
  requested: number,
  now: number
): Effect.Effect<
  { newBucket: Bucket; result: RateLimitResult },
  BucketExhaustedError
> =>
  Effect.gen(function* () {
    const refilled = applyRefill(bucket, cfg, now);
    const rate = cfg.maxRequests / cfg.windowMs;

    if (refilled.tokens < requested) {
      const shortfall = requested - refilled.tokens;
      const retryAfter = Math.ceil(shortfall / rate);
      yield* Effect.fail(
        new BucketExhaustedError({
          userId,
          retryAfter,
          remaining: Math.floor(refilled.tokens),
        })
      );
    }

    const newTokens = refilled.tokens - requested;
    const newBucket: Bucket = { tokens: newTokens, lastRefill: now };
    const resetAt = new Date(now + msToFull(newTokens, cfg));

    return {
      newBucket,
      result: {
        allowed: true,
        remaining: Math.floor(newTokens),
        resetAt,
      },
    };
  });

// ─── Public factory ───────────────────────────────────────────────────────────

/**
 * Create a token-bucket rate limiter.
 *
 * Invariants:
 *   ∀ valid config: 0 ≤ bucket.tokens ≤ burstCapacity at all times
 *   ∀ consume(u, n): if allowed, bucket.tokens decreases by exactly n
 *   ∀ elapsed > windowMs after last consume: tokens ≥ maxRequests (bucket at least full)
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  // Validate synchronously at construction time
  const exit = Effect.runSyncExit(validateConfig(config));
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
  const cfg = exit.value;

  const buckets = new Map<string, Bucket>();

  const getOrCreate = (userId: string, now: number): Bucket => {
    if (!buckets.has(userId)) {
      buckets.set(userId, { tokens: cfg.burstCapacity, lastRefill: now });
    }
    return buckets.get(userId)!;
  };

  return {
    consume(userId: string, tokens = 1): RateLimitResult {
      if (!Number.isFinite(tokens) || tokens <= 0)
        throw new Error("tokens must be a positive finite number");

      const now = Date.now();
      const bucket = getOrCreate(userId, now);
      const consumeExit = Effect.runSyncExit(tryConsume(bucket, cfg, userId, tokens, now));

      if (Exit.isFailure(consumeExit)) {
        const err = Cause.squash(consumeExit.cause);

        if (err instanceof BucketExhaustedError) {
          // Persist the refilled (but not consumed) state
          const refilled = applyRefill(bucket, cfg, now);
          buckets.set(userId, refilled);
          return {
            allowed: false,
            remaining: err.remaining,
            resetAt: new Date(now + msToFull(refilled.tokens, cfg)),
            retryAfter: err.retryAfter,
          };
        }

        if (err instanceof Error) throw err;
        throw new Error(String(err));
      }

      const { newBucket, result } = consumeExit.value;
      buckets.set(userId, newBucket);
      return result;
    },

    getStatus(userId: string): UserStatus {
      const now = Date.now();
      const bucket = getOrCreate(userId, now);
      const refilled = applyRefill(bucket, cfg, now);
      // Persist the lazily-refilled state
      buckets.set(userId, refilled);
      return {
        userId,
        tokens: Math.floor(refilled.tokens),
        capacity: cfg.burstCapacity,
        resetAt: new Date(now + msToFull(refilled.tokens, cfg)),
      };
    },

    reset(userId: string): void {
      buckets.set(userId, { tokens: cfg.burstCapacity, lastRefill: Date.now() });
    },

    resetAll(): void {
      buckets.clear();
    },
  };
}