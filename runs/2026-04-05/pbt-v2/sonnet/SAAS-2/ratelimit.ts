// ratelimit.ts — Token bucket rate limiter with per-user limits, burst capacity, and sliding window

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Tokens replenished per interval */
  tokensPerInterval: number;
  /** Interval length in milliseconds */
  intervalMs: number;
  /** Maximum tokens the bucket can hold (burst capacity) */
  burstCapacity: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Tokens remaining after this consume call */
  remaining: number;
  /** Unix timestamp (ms) when the bucket will next be fully replenished */
  resetAt: number;
  /** Milliseconds the caller should wait before retrying (0 when allowed) */
  retryAfter: number;
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Unix ms
}

export interface SlidingWindowState {
  /** Sorted list of request timestamps (Unix ms) within the current window */
  timestamps: number[];
}

// ---------------------------------------------------------------------------
// Token-Bucket Rate Limiter
// ---------------------------------------------------------------------------

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucketState>();
  private readonly cfg: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    if (config.tokensPerInterval <= 0) throw new RangeError("tokensPerInterval must be > 0");
    if (config.intervalMs <= 0) throw new RangeError("intervalMs must be > 0");
    if (config.burstCapacity <= 0) throw new RangeError("burstCapacity must be > 0");
    this.cfg = { ...config };
  }

  /**
   * Attempt to consume `cost` tokens for `userId`.
   * Returns a {@link RateLimitResult} describing whether the request is allowed.
   */
  consume(userId: string, cost = 1, now = Date.now()): RateLimitResult {
    if (cost <= 0) throw new RangeError("cost must be > 0");

    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: this.cfg.burstCapacity, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill proportionally to elapsed time
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const refill = (elapsed / this.cfg.intervalMs) * this.cfg.tokensPerInterval;
    bucket.tokens = Math.min(this.cfg.burstCapacity, bucket.tokens + refill);
    bucket.lastRefill = now;

    const { burstCapacity, tokensPerInterval, intervalMs } = this.cfg;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      const remaining = Math.floor(bucket.tokens);
      const msToFull = ((burstCapacity - bucket.tokens) / tokensPerInterval) * intervalMs;
      return { allowed: true, remaining, resetAt: now + msToFull, retryAfter: 0 };
    }

    // Not enough tokens
    const deficit = cost - bucket.tokens;
    const retryAfter = Math.ceil((deficit / tokensPerInterval) * intervalMs);
    const msToFull = ((burstCapacity - bucket.tokens) / tokensPerInterval) * intervalMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + msToFull,
      retryAfter,
    };
  }

  /** Peek at the current bucket state without consuming tokens. */
  getState(userId: string): TokenBucketState | undefined {
    const b = this.buckets.get(userId);
    return b ? { ...b } : undefined;
  }

  /** Fully reset a user's bucket (removes the entry). */
  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  /** Reset all buckets. */
  resetAll(): void {
    this.buckets.clear();
  }

  /** Number of users currently tracked. */
  get size(): number {
    return this.buckets.size;
  }
}

// ---------------------------------------------------------------------------
// Sliding-Window Rate Limiter
// ---------------------------------------------------------------------------

export class SlidingWindowRateLimiter {
  private readonly windows = new Map<string, SlidingWindowState>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    if (limit <= 0) throw new RangeError("limit must be > 0");
    if (windowMs <= 0) throw new RangeError("windowMs must be > 0");
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Attempt to record one request for `userId` within the sliding window.
   */
  consume(userId: string, now = Date.now()): RateLimitResult {
    let state = this.windows.get(userId);
    if (!state) {
      state = { timestamps: [] };
      this.windows.set(userId, state);
    }

    // Evict timestamps outside the current window
    const cutoff = now - this.windowMs;
    // timestamps are kept sorted ascending; drop from the front
    let start = 0;
    while (start < state.timestamps.length && state.timestamps[start] <= cutoff) {
      start++;
    }
    if (start > 0) state.timestamps.splice(0, start);

    const count = state.timestamps.length;

    if (count < this.limit) {
      state.timestamps.push(now);
      const remaining = this.limit - count - 1;
      // resetAt: when the oldest request will leave the window
      const resetAt = state.timestamps.length > 0
        ? state.timestamps[0] + this.windowMs
        : now + this.windowMs;
      return { allowed: true, remaining, resetAt, retryAfter: 0 };
    }

    // Window is full
    const oldest = state.timestamps[0];
    const resetAt = oldest + this.windowMs;
    const retryAfter = Math.max(0, resetAt - now);
    return { allowed: false, remaining: 0, resetAt, retryAfter };
  }

  /** Peek at the (pruned) window state for a user. */
  getState(userId: string, now = Date.now()): SlidingWindowState | undefined {
    const state = this.windows.get(userId);
    if (!state) return undefined;
    const cutoff = now - this.windowMs;
    return { timestamps: state.timestamps.filter((t) => t > cutoff) };
  }

  /** Remove all recorded requests for a user. */
  reset(userId: string): void {
    this.windows.delete(userId);
  }

  /** Remove all windows. */
  resetAll(): void {
    this.windows.clear();
  }

  /** Number of users currently tracked. */
  get size(): number {
    return this.windows.size;
  }
}

// ---------------------------------------------------------------------------
// Composite Rate Limiter (token-bucket + sliding window, both must pass)
// ---------------------------------------------------------------------------

export interface CompositeRateLimitConfig {
  tokenBucket: RateLimitConfig;
  slidingWindow: { limit: number; windowMs: number };
}

export class CompositeRateLimiter {
  private readonly bucket: RateLimiter;
  private readonly sliding: SlidingWindowRateLimiter;

  constructor(config: CompositeRateLimitConfig) {
    this.bucket = new RateLimiter(config.tokenBucket);
    this.sliding = new SlidingWindowRateLimiter(
      config.slidingWindow.limit,
      config.slidingWindow.windowMs,
    );
  }

  consume(userId: string, cost = 1, now = Date.now()): RateLimitResult {
    const swResult = this.sliding.consume(userId, now);
    const tbResult = this.bucket.consume(userId, cost, now);

    if (swResult.allowed && tbResult.allowed) {
      return {
        allowed: true,
        remaining: Math.min(swResult.remaining, tbResult.remaining),
        resetAt: Math.max(swResult.resetAt, tbResult.resetAt),
        retryAfter: 0,
      };
    }

    // Roll back sliding-window entry when bucket denied (to keep them in sync)
    if (!tbResult.allowed && swResult.allowed) {
      // The sliding window recorded an entry we want to undo — reset is the
      // safest no-op approximation without full transactional support.
      // In practice callers check `allowed` before proceeding, so this keeps
      // the window accurate.
      const state = this.sliding.getState(userId, now);
      if (state) {
        // Remove the most-recently added timestamp
        const s = (this.sliding as unknown as { windows: Map<string, SlidingWindowState> }).windows.get(userId);
        if (s && s.timestamps.length > 0) s.timestamps.pop();
      }
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.max(swResult.resetAt, tbResult.resetAt),
      retryAfter: Math.max(swResult.retryAfter, tbResult.retryAfter),
    };
  }

  reset(userId: string): void {
    this.bucket.reset(userId);
    this.sliding.reset(userId);
  }

  resetAll(): void {
    this.bucket.resetAll();
    this.sliding.resetAll();
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a token-bucket {@link RateLimiter}.
 *
 * @example
 * const limiter = createRateLimiter({ tokensPerInterval: 10, intervalMs: 1000, burstCapacity: 20 });
 * const result = limiter.consume("user-42");
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Create a sliding-window {@link SlidingWindowRateLimiter}.
 *
 * @example
 * const limiter = createSlidingWindowRateLimiter(100, 60_000); // 100 req/min
 */
export function createSlidingWindowRateLimiter(
  limit: number,
  windowMs: number,
): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(limit, windowMs);
}

/**
 * Create a {@link CompositeRateLimiter} that enforces both a token-bucket and
 * a sliding-window policy simultaneously.
 */
export function createCompositeRateLimiter(
  config: CompositeRateLimitConfig,
): CompositeRateLimiter {
  return new CompositeRateLimiter(config);
}