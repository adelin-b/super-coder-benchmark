import { Effect } from "effect";

function createRateLimiterEffect(options: {
  refillRate: number;
  maxTokens: number;
}): Effect.Effect<
  {
    tryConsume(userId: string, tokens?: number): boolean;
    getRemaining(userId: string): number;
    reset(userId: string): void;
  },
  never
> {
  return Effect.sync(() => {
    if (options.refillRate <= 0) throw new Error("refillRate must be positive");
    if (options.maxTokens <= 0) throw new Error("maxTokens must be positive");

    interface UserBucket {
      tokens: number;
      lastRefillTime: number;
    }

    const buckets = new Map<string, UserBucket>();

    const refillTokens = (bucket: UserBucket): void => {
      const now = Date.now();
      const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
      const refilled = Math.floor(elapsedSeconds * options.refillRate);
      bucket.tokens = Math.min(options.maxTokens, bucket.tokens + refilled);
      bucket.lastRefillTime = now;
    };

    const getBucket = (userId: string): UserBucket => {
      if (!buckets.has(userId)) {
        buckets.set(userId, {
          tokens: options.maxTokens,
          lastRefillTime: Date.now(),
        });
      }
      return buckets.get(userId)!;
    };

    return {
      tryConsume(userId: string, tokensRequested: number = 1): boolean {
        if (tokensRequested < 0) throw new Error("tokens must be non-negative");
        if (tokensRequested === 0) return true;

        const bucket = getBucket(userId);
        refillTokens(bucket);

        if (bucket.tokens >= tokensRequested) {
          bucket.tokens -= tokensRequested;
          return true;
        }
        return false;
      },

      getRemaining(userId: string): number {
        const bucket = getBucket(userId);
        refillTokens(bucket);
        return bucket.tokens;
      },

      reset(userId: string): void {
        buckets.delete(userId);
      },
    };
  });
}

export function createRateLimiter(options: {
  refillRate: number;
  maxTokens: number;
}): {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
} {
  return Effect.runSync(createRateLimiterEffect(options));
}