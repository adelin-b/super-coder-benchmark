import { Effect, Data } from 'effect';

class RateLimitError extends Data.TaggedError('RateLimitError')<{ reason: string }> {}

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface RateLimiter {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

function createRateLimiterInternal(config: RateLimitConfig): Effect.Effect<RateLimiter, RateLimitError> {
  return Effect.gen(function* () {
    if (config.maxTokens <= 0) {
      yield* Effect.fail(new RateLimitError({ reason: 'maxTokens must be positive' }));
    }
    if (config.refillRate <= 0) {
      yield* Effect.fail(new RateLimitError({ reason: 'refillRate must be positive' }));
    }
    if (config.refillIntervalMs <= 0) {
      yield* Effect.fail(new RateLimitError({ reason: 'refillIntervalMs must be positive' }));
    }

    const buckets = new Map<string, Bucket>();

    const getBucket = (userId: string): Bucket => {
      if (!buckets.has(userId)) {
        buckets.set(userId, { tokens: config.maxTokens, lastRefill: Date.now() });
      }
      return buckets.get(userId)!;
    };

    const refill = (bucket: Bucket): void => {
      const now = Date.now();
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = Math.floor(elapsed / config.refillIntervalMs) * config.refillRate;
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }
    };

    return {
      tryConsume: (userId: string, tokens: number = 1): boolean => {
        const bucket = getBucket(userId);
        refill(bucket);
        if (bucket.tokens >= tokens) {
          bucket.tokens -= tokens;
          return true;
        }
        return false;
      },
      getRemaining: (userId: string): number => {
        const bucket = getBucket(userId);
        refill(bucket);
        return bucket.tokens;
      },
      reset: (userId: string): void => {
        const bucket = getBucket(userId);
        bucket.tokens = config.maxTokens;
        bucket.lastRefill = Date.now();
      },
    };
  });
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  try {
    return Effect.runSync(createRateLimiterInternal(config));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('RateLimitError')) {
      throw new RateLimitErrorClass((e as any).reason || 'Rate limit configuration error');
    }
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

class RateLimitErrorClass extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitErrorClass.prototype);
  }
}

export { RateLimitErrorClass as RateLimitError };