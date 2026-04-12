import { Effect, Exit, Cause } from "effect";

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

export interface RateLimiter {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
}

interface BucketState {
  tokens: number;
  lastRefillTime: number;
}

function createRateLimiterEffect(config: RateLimiterConfig): Effect.Effect<RateLimiter, RateLimitError> {
  return Effect.gen(function* () {
    if (config.maxTokens <= 0) {
      return yield* Effect.fail(new RateLimitError("maxTokens must be greater than 0"));
    }
    if (config.refillRate <= 0) {
      return yield* Effect.fail(new RateLimitError("refillRate must be greater than 0"));
    }
    if (config.refillIntervalMs <= 0) {
      return yield* Effect.fail(new RateLimitError("refillIntervalMs must be greater than 0"));
    }

    const buckets = new Map<string, BucketState>();

    function getBucket(userId: string): BucketState {
      if (!buckets.has(userId)) {
        buckets.set(userId, { tokens: config.maxTokens, lastRefillTime: Date.now() });
      }
      return buckets.get(userId)!;
    }

    function refill(bucket: BucketState): void {
      const now = Date.now();
      const elapsed = now - bucket.lastRefillTime;
      const intervals = Math.floor(elapsed / config.refillIntervalMs);
      if (intervals > 0) {
        bucket.tokens = Math.min(config.maxTokens, bucket.tokens + intervals * config.refillRate);
        bucket.lastRefillTime = bucket.lastRefillTime + intervals * config.refillIntervalMs;
      }
    }

    return {
      tryConsume(userId: string, tokens: number = 1): boolean {
        const bucket = getBucket(userId);
        refill(bucket);
        if (bucket.tokens >= tokens) {
          bucket.tokens -= tokens;
          return true;
        }
        return false;
      },

      getRemaining(userId: string): number {
        const bucket = getBucket(userId);
        refill(bucket);
        return bucket.tokens;
      },

      reset(userId: string): void {
        buckets.set(userId, { tokens: config.maxTokens, lastRefillTime: Date.now() });
      },
    };
  });
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const exit = Effect.runSyncExit(createRateLimiterEffect(config));
  if (Exit.isFailure(exit)) {
    const raw = Cause.squash(exit.cause);
    if (raw instanceof RateLimitError) throw raw;
    const msg = raw instanceof Error ? raw.message : String(raw);
    throw new RateLimitError(msg);
  }
  return exit.value;
}