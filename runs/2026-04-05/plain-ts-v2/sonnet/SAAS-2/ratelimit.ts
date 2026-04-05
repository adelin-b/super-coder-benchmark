// ratelimit.ts

export interface RateLimiterConfig {
  /** Duration of the sliding window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed per window */
  maxRequests: number;
  /** Maximum burst capacity (token bucket size) */
  burstCapacity: number;
  /** Token refill rate in tokens per millisecond */
  refillRate: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining tokens in the bucket */
  remainingTokens: number;
  /** Remaining requests allowed in the current sliding window */
  remainingRequests: number;
  /** Timestamp (ms since epoch) when the oldest window entry expires */
  resetAt: number;
  /** Milliseconds to wait before retrying (only set when allowed is false) */
  retryAfter?: number;
}

export interface UserState {
  /** Current token count in the bucket */
  tokens: number;
  /** Timestamp of the last token refill */
  lastRefill: number;
  /** Timestamps of requests within the current sliding window */
  windowTimestamps: number[];
}

export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimiterError";
  }
}

function validateConfig(config: RateLimiterConfig): void {
  if (!config || typeof config !== "object") {
    throw new RateLimiterError("Config must be a non-null object.");
  }
  if (!Number.isFinite(config.windowMs) || config.windowMs <= 0) {
    throw new RateLimiterError("windowMs must be a positive finite number.");
  }
  if (!Number.isInteger(config.maxRequests) || config.maxRequests < 0) {
    throw new RateLimiterError("maxRequests must be a non-negative integer.");
  }
  if (!Number.isFinite(config.burstCapacity) || config.burstCapacity < 0) {
    throw new RateLimiterError("burstCapacity must be a non-negative finite number.");
  }
  if (!Number.isFinite(config.refillRate) || config.refillRate < 0) {
    throw new RateLimiterError("refillRate must be a non-negative finite number.");
  }
}

export class RateLimiter {
  private readonly config: Readonly<RateLimiterConfig>;
  private readonly users: Map<string, UserState>;

  constructor(config: RateLimiterConfig) {
    validateConfig(config);
    this.config = Object.freeze({ ...config });
    this.users = new Map();
  }

  /**
   * Check and consume tokens for a given user.
   * @param userId  A non-empty string identifying the user/key.
   * @param cost    Number of tokens this request costs (default: 1).
   */
  check(userId: string, cost: number = 1): RateLimitResult {
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new RateLimiterError("userId must be a non-empty string.");
    }
    if (!Number.isFinite(cost) || cost < 0) {
      throw new RateLimiterError("cost must be a non-negative finite number.");
    }

    const now = Date.now();
    const state = this._getOrCreateState(userId, now);

    // ── Token bucket: refill ──────────────────────────────────────────────
    const elapsed = now - state.lastRefill;
    const refilled = elapsed * this.config.refillRate;
    state.tokens = Math.min(state.tokens + refilled, this.config.burstCapacity);
    state.lastRefill = now;

    // ── Sliding window: evict stale timestamps ────────────────────────────
    const windowStart = now - this.config.windowMs;
    state.windowTimestamps = state.windowTimestamps.filter((t) => t > windowStart);

    const windowCount = state.windowTimestamps.length;

    // ── Evaluate limits ───────────────────────────────────────────────────
    const bucketDenied = state.tokens < cost;
    const windowDenied = windowCount >= this.config.maxRequests;

    const resetAt =
      state.windowTimestamps.length > 0
        ? state.windowTimestamps[0] + this.config.windowMs
        : now + this.config.windowMs;

    if (bucketDenied || windowDenied) {
      let retryAfter: number;

      if (bucketDenied && !windowDenied) {
        // Time for enough tokens to accumulate
        const deficit = cost - state.tokens;
        retryAfter = this.config.refillRate > 0
          ? Math.ceil(deficit / this.config.refillRate)
          : Infinity;
      } else if (windowDenied && !bucketDenied) {
        // Time until the oldest timestamp leaves the window
        retryAfter = Math.max(0, resetAt - now);
      } else {
        // Both denied — take the longer wait
        const deficit = cost - state.tokens;
        const tokenWait = this.config.refillRate > 0
          ? Math.ceil(deficit / this.config.refillRate)
          : Infinity;
        const windowWait = Math.max(0, resetAt - now);
        retryAfter = Math.max(tokenWait, windowWait);
      }

      return {
        allowed: false,
        remainingTokens: Math.floor(state.tokens),
        remainingRequests: Math.max(0, this.config.maxRequests - windowCount),
        resetAt,
        retryAfter,
      };
    }

    // ── Allow: consume ────────────────────────────────────────────────────
    state.tokens -= cost;
    state.windowTimestamps.push(now);

    const newWindowCount = state.windowTimestamps.length;

    return {
      allowed: true,
      remainingTokens: Math.floor(state.tokens),
      remainingRequests: Math.max(0, this.config.maxRequests - newWindowCount),
      resetAt:
        state.windowTimestamps.length > 0
          ? state.windowTimestamps[0] + this.config.windowMs
          : now + this.config.windowMs,
    };
  }

  /**
   * Reset the state for a specific user, as if they have never made a request.
   */
  reset(userId: string): void {
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new RateLimiterError("userId must be a non-empty string.");
    }
    this.users.delete(userId);
  }

  /**
   * Reset the state for ALL users.
   */
  resetAll(): void {
    this.users.clear();
  }

  /**
   * Retrieve the current state snapshot for a user without modifying it.
   * Returns undefined if the user has no recorded state.
   */
  getState(userId: string): Readonly<UserState> | undefined {
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new RateLimiterError("userId must be a non-empty string.");
    }
    const state = this.users.get(userId);
    if (!state) return undefined;
    return {
      tokens: state.tokens,
      lastRefill: state.lastRefill,
      windowTimestamps: [...state.windowTimestamps],
    };
  }

  /**
   * Number of users currently tracked.
   */
  get size(): number {
    return this.users.size;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _getOrCreateState(userId: string, now: number): UserState {
    let state = this.users.get(userId);
    if (!state) {
      state = {
        tokens: this.config.burstCapacity,
        lastRefill: now,
        windowTimestamps: [],
      };
      this.users.set(userId, state);
    }
    return state;
  }
}