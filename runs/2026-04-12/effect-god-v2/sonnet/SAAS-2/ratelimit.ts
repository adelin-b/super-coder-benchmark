import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain Errors ────────────────────────────────────────────────────────────

class InvalidConfigError extends Data.TaggedError("InvalidConfigError")<{
  reason: string;
}> {}

class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<{
  reason: string;
}> {}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Maximum number of tokens (burst capacity) */
  capacity: number;
  /** Tokens added per second */
  refillRate: number;
  /** Sliding window duration in milliseconds (default: 1000) */
  windowMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining tokens after this request */
  remaining: number;
  /** How many ms to wait before retrying (0 if allowed) */
  retryAfterMs: number;
  /** Epoch ms when the bucket will be full again */
  resetAtMs: number;
  /** Total tokens consumed in the current window */
  consumedInWindow: number;
}

export interface UserStats {
  userId: string;
  currentTokens: number;
  capacity: number;
  refillRate: number;
  lastRefillAt: number;
  consumedInWindow: number;
  windowMs: number;
}

export interface RateLimiter {
  /**
   * Check whether consuming `tokens` (default 1) would be allowed,
   * WITHOUT actually consuming any tokens.
   */
  check(userId: string, tokens?: number): RateLimitResult;

  /**
   * Attempt to consume `tokens` (default 1) from the user's bucket.
   * Returns the result including whether it was allowed.
   */
  consume(userId: string, tokens?: number): RateLimitResult;

  /**
   * Reset the bucket for a given user, restoring full capacity.
   */
  reset(userId: string): void;

  /**
   * Remove a user's bucket entirely.
   */
  delete(userId: string): void;

  /**
   * Return current stats for a user (creates a fresh bucket if none exists).
   */
  getStats(userId: string): UserStats;

  /**
   * Return the number of distinct users currently tracked.
   */
  size(): number;
}

// ─── Internal State ──────────────────────────────────────────────────────────

interface Bucket {
  tokens: number;
  lastRefillAt: number;
  windowRequests: Array<{ at: number; amount: number }>;
}

// ─── Internal Effect Logic ───────────────────────────────────────────────────

const validateConfig = (
  config: RateLimiterConfig
): Effect.Effect<Required<RateLimiterConfig>, InvalidConfigError> =>
  Effect.gen(function* () {
    if (config.capacity <= 0)
      yield* Effect.fail(
        new InvalidConfigError({ reason: "capacity must be > 0" })
      );
    if (config.refillRate <= 0)
      yield* Effect.fail(
        new InvalidConfigError({ reason: "refillRate must be > 0" })
      );
    const windowMs = config.windowMs ?? 1000;
    if (windowMs <= 0)
      yield* Effect.fail(
        new InvalidConfigError({ reason: "windowMs must be > 0" })
      );
    return { capacity: config.capacity, refillRate: config.refillRate, windowMs };
  });

const validateTokenRequest = (
  tokens: number
): Effect.Effect<void, InvalidRequestError> =>
  Effect.gen(function* () {
    if (!Number.isFinite(tokens) || tokens <= 0)
      yield* Effect.fail(
        new InvalidRequestError({ reason: "tokens must be a positive finite number" })
      );
  });

const refillBucket = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  now: number
): Bucket => {
  const elapsed = Math.max(0, now - bucket.lastRefillAt) / 1000; // seconds
  const added = elapsed * cfg.refillRate;
  const tokens = Math.min(cfg.capacity, bucket.tokens + added);
  return { ...bucket, tokens, lastRefillAt: now };
};

const pruneWindow = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  now: number
): Bucket => ({
  ...bucket,
  windowRequests: bucket.windowRequests.filter(
    (r) => now - r.at < cfg.windowMs
  ),
});

const windowConsumed = (bucket: Bucket): number =>
  bucket.windowRequests.reduce((sum, r) => sum + r.amount, 0);

const computeRetryAfterMs = (
  needed: number,
  current: number,
  refillRate: number
): number => {
  const deficit = needed - current;
  if (deficit <= 0) return 0;
  return Math.ceil((deficit / refillRate) * 1000);
};

const computeResetAtMs = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  now: number
): number => {
  const deficit = cfg.capacity - bucket.tokens;
  if (deficit <= 0) return now;
  const msToFull = Math.ceil((deficit / cfg.refillRate) * 1000);
  return now + msToFull;
};

const attemptConsume = (
  bucket: Bucket,
  cfg: Required<RateLimiterConfig>,
  tokens: number,
  now: number,
  dryRun: boolean
): { result: RateLimitResult; nextBucket: Bucket } => {
  const refilled = refillBucket(bucket, cfg, now);
  const pruned = pruneWindow(refilled, cfg, now);

  const allowed = pruned.tokens >= tokens;
  const nextTokens = allowed && !dryRun ? pruned.tokens - tokens : pruned.tokens;
  const windowReqs =
    allowed && !dryRun
      ? [...pruned.windowRequests, { at: now, amount: tokens }]
      : pruned.windowRequests;

  const nextBucket: Bucket = {
    tokens: nextTokens,
    lastRefillAt: pruned.lastRefillAt,
    windowRequests: windowReqs,
  };

  const consumed = windowConsumed(nextBucket);

  const result: RateLimitResult = {
    allowed,
    remaining: Math.floor(nextTokens * 1000) / 1000,
    retryAfterMs: allowed
      ? 0
      : computeRetryAfterMs(tokens, pruned.tokens, cfg.refillRate),
    resetAtMs: computeResetAtMs(nextBucket, cfg, now),
    consumedInWindow: consumed,
  };

  return { result, nextBucket };
};

// ─── Factory ─────────────────────────────────────────────────────────────────

export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimiterError";
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  // Validate config eagerly
  const cfgExit = Effect.runSyncExit(validateConfig(config));
  if (Exit.isFailure(cfgExit)) {
    const err = Cause.squash(cfgExit.cause);
    throw new RateLimiterError(err instanceof Error ? err.message : String(err));
  }
  const cfg = cfgExit.value;

  const buckets = new Map<string, Bucket>();

  const getOrCreate = (userId: string): Bucket => {
    if (!buckets.has(userId)) {
      buckets.set(userId, {
        tokens: cfg.capacity,
        lastRefillAt: Date.now(),
        windowRequests: [],
      });
    }
    return buckets.get(userId)!;
  };

  const runConsume = (
    userId: string,
    tokens: number,
    dryRun: boolean
  ): RateLimitResult => {
    const validationExit = Effect.runSyncExit(validateTokenRequest(tokens));
    if (Exit.isFailure(validationExit)) {
      const err = Cause.squash(validationExit.cause);
      throw new RateLimiterError(err instanceof Error ? err.message : String(err));
    }

    const bucket = getOrCreate(userId);
    const now = Date.now();
    const { result, nextBucket } = attemptConsume(bucket, cfg, tokens, now, dryRun);

    if (!dryRun) {
      buckets.set(userId, nextBucket);
    }

    return result;
  };

  return {
    check(userId: string, tokens = 1): RateLimitResult {
      return runConsume(userId, tokens, true);
    },

    consume(userId: string, tokens = 1): RateLimitResult {
      return runConsume(userId, tokens, false);
    },

    reset(userId: string): void {
      buckets.set(userId, {
        tokens: cfg.capacity,
        lastRefillAt: Date.now(),
        windowRequests: [],
      });
    },

    delete(userId: string): void {
      buckets.delete(userId);
    },

    getStats(userId: string): UserStats {
      const bucket = getOrCreate(userId);
      const now = Date.now();
      const refilled = refillBucket(bucket, cfg, now);
      const pruned = pruneWindow(refilled, cfg, now);
      return {
        userId,
        currentTokens: Math.floor(pruned.tokens * 1000) / 1000,
        capacity: cfg.capacity,
        refillRate: cfg.refillRate,
        lastRefillAt: pruned.lastRefillAt,
        consumedInWindow: windowConsumed(pruned),
        windowMs: cfg.windowMs,
      };
    },

    size(): number {
      return buckets.size;
    },
  };
}