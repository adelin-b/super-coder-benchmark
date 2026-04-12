import { Effect, Data, Exit, Cause } from "effect";

// ─── Public Error ────────────────────────────────────────────────────────────

export class RateLimitExceededError extends Error {
  public readonly userId: string;
  public readonly requested: number;
  public readonly available: number;
  public readonly retryAfterMs: number;

  constructor(opts: {
    userId: string;
    requested: number;
    available: number;
    retryAfterMs: number;
  }) {
    super(
      `Rate limit exceeded for user "${opts.userId}": requested ${opts.requested} token(s), only ${opts.available.toFixed(2)} available. Retry after ${opts.retryAfterMs}ms.`
    );
    this.name = "RateLimitExceededError";
    this.userId = opts.userId;
    this.requested = opts.requested;
    this.available = opts.available;
    this.retryAfterMs = opts.retryAfterMs;
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

// ─── Config & Public Interface ───────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Tokens added per interval */
  tokensPerInterval: number;
  /** Interval duration in milliseconds */
  intervalMs: number;
  /** Maximum burst capacity (bucket size) */
  burstCapacity: number;
}

export interface UserStats {
  tokens: number;
  lastRefillAt: number;
  totalConsumed: number;
  totalRequests: number;
  rejectedRequests: number;
}

export interface RateLimiter {
  /**
   * Attempt to consume `tokens` (default 1) from the user's bucket.
   * Throws RateLimitExceededError if insufficient tokens.
   */
  consume(userId: string, tokens?: number): void;

  /**
   * Check whether `tokens` (default 1) are available for the user
   * WITHOUT consuming them. Returns true if allowed.
   */
  check(userId: string, tokens?: number): boolean;

  /**
   * Return the current (fractional) token count for a user.
   * Reflects any tokens that have refilled since last consume.
   */
  getTokens(userId: string): number;

  /**
   * Reset a specific user's bucket to full capacity.
   */
  reset(userId: string): void;

  /**
   * Reset all user buckets.
   */
  resetAll(): void;

  /**
   * Return usage statistics for a user.
   */
  getStats(userId: string): UserStats;

  /**
   * Remove all state for a specific user (useful for cleanup / logout).
   */
  evict(userId: string): void;
}

// ─── Internal Tagged Errors ──────────────────────────────────────────────────

class InternalRateLimitExceeded extends Data.TaggedError(
  "InternalRateLimitExceeded"
)<{
  userId: string;
  requested: number;
  available: number;
  retryAfterMs: number;
}> {}

class InternalValidationError extends Data.TaggedError("InternalValidationError")<{
  reason: string;
}> {}

// ─── Internal Bucket State ───────────────────────────────────────────────────

interface BucketState {
  tokens: number;
  lastRefillAt: number;
  totalConsumed: number;
  totalRequests: number;
  rejectedRequests: number;
}

// ─── Core Effect Logic ───────────────────────────────────────────────────────

const refillTokens = (
  bucket: BucketState,
  config: RateLimiterConfig,
  now: number
): BucketState => {
  const elapsed = now - bucket.lastRefillAt;
  if (elapsed <= 0) return bucket;
  const refill = (elapsed / config.intervalMs) * config.tokensPerInterval;
  const newTokens = Math.min(bucket.tokens + refill, config.burstCapacity);
  return { ...bucket, tokens: newTokens, lastRefillAt: now };
};

const computeRetryAfterMs = (
  tokensNeeded: number,
  config: RateLimiterConfig
): number => {
  if (tokensNeeded <= 0) return 0;
  return Math.ceil((tokensNeeded / config.tokensPerInterval) * config.intervalMs);
};

const checkInternal = (
  bucket: BucketState,
  config: RateLimiterConfig,
  tokens: number,
  now: number
): Effect.Effect<BucketState, InternalRateLimitExceeded | InternalValidationError, never> =>
  Effect.gen(function* () {
    if (tokens <= 0) {
      yield* Effect.fail(
        new InternalValidationError({ reason: "tokens must be > 0" })
      );
    }
    if (tokens > config.burstCapacity) {
      yield* Effect.fail(
        new InternalValidationError({
          reason: `tokens (${tokens}) exceeds burstCapacity (${config.burstCapacity})`,
        })
      );
    }

    const refilled = refillTokens(bucket, config, now);

    if (refilled.tokens < tokens) {
      const retryAfterMs = computeRetryAfterMs(
        tokens - refilled.tokens,
        config
      );
      yield* Effect.fail(
        new InternalRateLimitExceeded({
          userId: "", // filled in at call site
          requested: tokens,
          available: refilled.tokens,
          retryAfterMs,
        })
      );
    }

    return refilled;
  });

const consumeInternal = (
  userId: string,
  bucket: BucketState,
  config: RateLimiterConfig,
  tokens: number,
  now: number
): Effect.Effect<BucketState, InternalRateLimitExceeded | InternalValidationError, never> =>
  Effect.gen(function* () {
    const refilled = yield* checkInternal(bucket, config, tokens, now).pipe(
      Effect.mapError((e) =>
        e._tag === "InternalRateLimitExceeded"
          ? new InternalRateLimitExceeded({ ...e, userId })
          : e
      )
    );

    return {
      ...refilled,
      tokens: refilled.tokens - tokens,
      totalConsumed: bucket.totalConsumed + tokens,
      totalRequests: bucket.totalRequests + 1,
    };
  });

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  // Validate config
  if (config.tokensPerInterval <= 0) {
    throw new Error("tokensPerInterval must be > 0");
  }
  if (config.intervalMs <= 0) {
    throw new Error("intervalMs must be > 0");
  }
  if (config.burstCapacity <= 0) {
    throw new Error("burstCapacity must be > 0");
  }
  if (config.tokensPerInterval > config.burstCapacity) {
    throw new Error("tokensPerInterval must be <= burstCapacity");
  }

  const buckets = new Map<string, BucketState>();

  const getOrCreate = (userId: string, now: number): BucketState => {
    if (!buckets.has(userId)) {
      buckets.set(userId, {
        tokens: config.burstCapacity,
        lastRefillAt: now,
        totalConsumed: 0,
        totalRequests: 0,
        rejectedRequests: 0,
      });
    }
    return buckets.get(userId)!;
  };

  const runEffect = <A>(
    eff: Effect.Effect<A, InternalRateLimitExceeded | InternalValidationError, never>,
    userId: string
  ): A => {
    const exit = Effect.runSyncExit(eff);
    if (Exit.isFailure(exit)) {
      const raw = Cause.squash(exit.cause);
      if (raw && typeof raw === "object" && "_tag" in raw) {
        const tagged = raw as InternalRateLimitExceeded | InternalValidationError;
        if (tagged._tag === "InternalRateLimitExceeded") {
          const e = tagged as InternalRateLimitExceeded;
          throw new RateLimitExceededError({
            userId: e.userId || userId,
            requested: e.requested,
            available: e.available,
            retryAfterMs: e.retryAfterMs,
          });
        }
        if (tagged._tag === "InternalValidationError") {
          throw new Error((tagged as InternalValidationError).reason);
        }
      }
      const msg = raw instanceof Error ? raw.message : String(raw);
      throw new Error(msg);
    }
    return exit.value;
  };

  return {
    consume(userId: string, tokens = 1): void {
      const now = Date.now();
      const bucket = getOrCreate(userId, now);

      const effect = consumeInternal(userId, bucket, config, tokens, now);
      const exit = Effect.runSyncExit(effect);

      if (Exit.isFailure(exit)) {
        // Track rejected request before re-throwing
        const updated = { ...bucket, rejectedRequests: bucket.rejectedRequests + 1, totalRequests: bucket.totalRequests + 1 };
        buckets.set(userId, updated);

        const raw = Cause.squash(exit.cause);
        if (raw && typeof raw === "object" && "_tag" in raw) {
          const tagged = raw as InternalRateLimitExceeded | InternalValidationError;
          if (tagged._tag === "InternalRateLimitExceeded") {
            const e = tagged as InternalRateLimitExceeded;
            throw new RateLimitExceededError({
              userId: e.userId || userId,
              requested: e.requested,
              available: e.available,
              retryAfterMs: e.retryAfterMs,
            });
          }
          if (tagged._tag === "InternalValidationError") {
            throw new Error((tagged as InternalValidationError).reason);
          }
        }
        const msg = raw instanceof Error ? raw.message : String(raw);
        throw new Error(msg);
      }

      buckets.set(userId, exit.value);
    },

    check(userId: string, tokens = 1): boolean {
      const now = Date.now();
      const bucket = getOrCreate(userId, now);
      const refilled = refillTokens(bucket, config, now);
      if (tokens <= 0 || tokens > config.burstCapacity) return false;
      return refilled.tokens >= tokens;
    },

    getTokens(userId: string): number {
      const now = Date.now();
      const bucket = getOrCreate(userId, now);
      const refilled = refillTokens(bucket, config, now);
      return refilled.tokens;
    },

    reset(userId: string): void {
      const now = Date.now();
      const existing = buckets.get(userId);
      buckets.set(userId, {
        tokens: config.burstCapacity,
        lastRefillAt: now,
        totalConsumed: existing?.totalConsumed ?? 0,
        totalRequests: existing?.totalRequests ?? 0,
        rejectedRequests: existing?.rejectedRequests ?? 0,
      });
    },

    resetAll(): void {
      const now = Date.now();
      for (const [userId, existing] of buckets.entries()) {
        buckets.set(userId, {
          tokens: config.burstCapacity,
          lastRefillAt: now,
          totalConsumed: existing.totalConsumed,
          totalRequests: existing.totalRequests,
          rejectedRequests: existing.rejectedRequests,
        });
      }
    },

    getStats(userId: string): UserStats {
      const now = Date.now();
      const bucket = getOrCreate(userId, now);
      const refilled = refillTokens(bucket, config, now);
      return {
        tokens: refilled.tokens,
        lastRefillAt: refilled.lastRefillAt,
        totalConsumed: bucket.totalConsumed,
        totalRequests: bucket.totalRequests,
        rejectedRequests: bucket.rejectedRequests,
      };
    },

    evict(userId: string): void {
      buckets.delete(userId);
    },
  };
}