// ratelimit.ts — Token bucket rate limiter with per-user limits, burst capacity, and sliding window

export interface RateLimitConfig {
  /** Duration of the sliding window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed per window (steady-state refill rate) */
  maxRequests: number;
  /** Maximum burst capacity (peak tokens the bucket can hold) */
  burstCapacity: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining tokens in the bucket */
  remaining: number;
  /** Milliseconds until the client may retry (0 if allowed) */
  retryAfterMs: number;
  /** Unix timestamp (ms) when the bucket resets to full capacity */
  resetAt: number;
  /** Total tokens consumed in the current window */
  consumedInWindow: number;
}

export interface UserBucketState {
  /** Current token count */
  tokens: number;
  /** Timestamp (ms) of the last token refill */
  lastRefillAt: number;
  /** Start of the current sliding window */
  windowStart: number;
  /** Number of requests consumed in the current window */
  windowCount: number;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly result: RateLimitResult,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class RateLimiter {
  private readonly buckets: Map<string, UserBucketState> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    if (config.windowMs <= 0) {
      throw new RangeError("windowMs must be greater than 0");
    }
    if (config.maxRequests <= 0) {
      throw new RangeError("maxRequests must be greater than 0");
    }
    if (config.burstCapacity < config.maxRequests) {
      throw new RangeError(
        "burstCapacity must be greater than or equal to maxRequests",
      );
    }
    this.config = { ...config };
  }

  /**
   * Attempt to consume `cost` tokens for `userId`.
   * Returns a RateLimitResult describing whether the request is allowed.
   */
  consume(userId: string, cost = 1): RateLimitResult {
    if (!userId || typeof userId !== "string") {
      throw new TypeError("userId must be a non-empty string");
    }
    if (cost <= 0 || !Number.isFinite(cost)) {
      throw new RangeError("cost must be a finite positive number");
    }

    const now = Date.now();
    const bucket = this._getOrCreateBucket(userId, now);

    // Refill tokens based on elapsed time (token bucket algorithm)
    this._refill(bucket, now);

    // Advance sliding window if necessary
    this._advanceWindow(bucket, now);

    const { windowMs, burstCapacity } = this.config;

    if (bucket.tokens >= cost) {
      // Allow the request
      bucket.tokens -= cost;
      bucket.windowCount += cost;

      const remaining = Math.floor(bucket.tokens);
      const resetAt = now + this._msUntilFull(bucket, now);

      return {
        allowed: true,
        remaining,
        retryAfterMs: 0,
        resetAt,
        consumedInWindow: bucket.windowCount,
      };
    }

    // Deny the request — calculate retry delay
    const tokensNeeded = cost - bucket.tokens;
    const refillRatePerMs = this.config.maxRequests / windowMs;
    const retryAfterMs = Math.ceil(tokensNeeded / refillRatePerMs);
    const resetAt = now + this._msUntilFull(bucket, now);

    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs,
      resetAt,
      consumedInWindow: bucket.windowCount,
    };
  }

  /**
   * Like consume(), but throws RateLimitError if the request is denied.
   */
  consumeOrThrow(userId: string, cost = 1): RateLimitResult {
    const result = this.consume(userId, cost);
    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for user "${userId}". Retry after ${result.retryAfterMs}ms.`,
        userId,
        result,
      );
    }
    return result;
  }

  /**
   * Inspect the current state for `userId` without consuming any tokens.
   */
  getStatus(userId: string): RateLimitResult {
    if (!userId || typeof userId !== "string") {
      throw new TypeError("userId must be a non-empty string");
    }

    const now = Date.now();
    const bucket = this._getOrCreateBucket(userId, now);
    this._refill(bucket, now);
    this._advanceWindow(bucket, now);

    const { windowMs } = this.config;
    const refillRatePerMs = this.config.maxRequests / windowMs;
    const remaining = Math.floor(bucket.tokens);
    const resetAt = now + this._msUntilFull(bucket, now);

    let retryAfterMs = 0;
    if (bucket.tokens < 1) {
      const tokensNeeded = 1 - bucket.tokens;
      retryAfterMs = Math.ceil(tokensNeeded / refillRatePerMs);
    }

    return {
      allowed: bucket.tokens >= 1,
      remaining,
      retryAfterMs,
      resetAt,
      consumedInWindow: bucket.windowCount,
    };
  }

  /**
   * Reset the bucket for `userId` to full capacity.
   */
  reset(userId: string): void {
    if (!userId || typeof userId !== "string") {
      throw new TypeError("userId must be a non-empty string");
    }
    const now = Date.now();
    this.buckets.set(userId, this._freshBucket(now));
  }

  /**
   * Remove all stored bucket state (useful for testing or cleanup).
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Returns the number of tracked users.
   */
  get size(): number {
    return this.buckets.size;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _getOrCreateBucket(userId: string, now: number): UserBucketState {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = this._freshBucket(now);
      this.buckets.set(userId, bucket);
    }
    return bucket;
  }

  private _freshBucket(now: number): UserBucketState {
    return {
      tokens: this.config.burstCapacity,
      lastRefillAt: now,
      windowStart: now,
      windowCount: 0,
    };
  }

  /**
   * Token-bucket refill: add tokens proportional to elapsed time.
   */
  private _refill(bucket: UserBucketState, now: number): void {
    const { windowMs, maxRequests, burstCapacity } = this.config;
    const elapsed = now - bucket.lastRefillAt;
    if (elapsed <= 0) return;

    const refillRatePerMs = maxRequests / windowMs;
    const tokensToAdd = elapsed * refillRatePerMs;
    bucket.tokens = Math.min(burstCapacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;
  }

  /**
   * Sliding-window reset: if the window has expired, start a new one.
   */
  private _advanceWindow(bucket: UserBucketState, now: number): void {
    const { windowMs } = this.config;
    if (now - bucket.windowStart >= windowMs) {
      bucket.windowStart = now;
      bucket.windowCount = 0;
    }
  }

  /**
   * Calculate milliseconds until the bucket is completely full again.
   */
  private _msUntilFull(bucket: UserBucketState, now: number): number {
    const { windowMs, maxRequests, burstCapacity } = this.config;
    const deficit = burstCapacity - bucket.tokens;
    if (deficit <= 0) return 0;
    const refillRatePerMs = maxRequests / windowMs;
    return Math.ceil(deficit / refillRatePerMs);
  }
}

/**
 * Convenience factory — creates a RateLimiter with the given config.
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Create a per-user rate-limit middleware helper.
 * Returns a function that, given a userId, calls consume() and returns the result.
 */
export function createUserLimiter(
  config: RateLimitConfig,
): (userId: string, cost?: number) => RateLimitResult {
  const limiter = new RateLimiter(config);
  return (userId: string, cost = 1) => limiter.consume(userId, cost);
}