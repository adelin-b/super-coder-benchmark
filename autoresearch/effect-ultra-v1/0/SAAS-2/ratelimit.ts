import { Effect, Data } from "effect";

interface RateLimiterConfig {
  rate: number;
  capacity: number;
}

interface RateLimiter {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
  resetAll(): void;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

class InvalidConfig extends Data.TaggedError("InvalidConfig")<{
  reason: string;
}> {}

function validateConfig(
  config: RateLimiterConfig
): Effect.Effect<RateLimiterConfig, InvalidConfig> {
  return Effect.gen(function* () {
    if (config.rate <= 0) {
      yield* Effect.fail(
        new InvalidConfig({ reason: "rate must be positive" })
      );
    }
    if (config.capacity <= 0) {
      yield* Effect.fail(
        new InvalidConfig({ reason: "capacity must be positive" })
      );
    }
    return config;
  });
}

function createRateLimiterInternal(
  config: RateLimiterConfig
): Effect.Effect<RateLimiter, InvalidConfig> {
  return Effect.gen(function* () {
    yield* validateConfig(config);

    const buckets: Map<string, UserBucket> = new Map();

    const refillBucket = (bucket: UserBucket): void => {
      const now = Date.now();
      const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
      const tokensToAdd = elapsedSeconds * config.rate;
      bucket.tokens = Math.min(config.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefillTime = now;
    };

    const getBucket = (userId: string): UserBucket => {
      if (!buckets.has(userId)) {
        buckets.set(userId, {
          tokens: config.capacity,
          lastRefillTime: Date.now(),
        });
      }
      return buckets.get(userId)!;
    };

    const rateLimiter: RateLimiter = {
      tryConsume(userId: string, tokens: number = 1): boolean {
        if (tokens <= 0) {
          throw new Error("tokens must be positive");
        }
        if (tokens > config.capacity) {
          return false;
        }

        const bucket = getBucket(userId);
        refillBucket(bucket);

        if (bucket.tokens >= tokens) {
          bucket.tokens -= tokens;
          return true;
        }
        return false;
      },

      getRemaining(userId: string): number {
        const bucket = getBucket(userId);
        refillBucket(bucket);
        return Math.floor(bucket.tokens);
      },

      reset(userId: string): void {
        buckets.set(userId, {
          tokens: config.capacity,
          lastRefillTime: Date.now(),
        });
      },

      resetAll(): void {
        buckets.clear();
      },
    };

    return rateLimiter;
  });
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (config.rate <= 0) {
    throw new Error("rate must be positive");
  }
  if (config.capacity <= 0) {
    throw new Error("capacity must be positive");
  }

  try {
    return Effect.runSync(createRateLimiterInternal(config));
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("Failed to create rate limiter");
  }
}

export type { RateLimiterConfig, RateLimiter };