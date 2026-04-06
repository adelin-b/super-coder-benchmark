import { Effect, Data } from "effect";

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

interface RateLimiter {
  tryConsume(userId: string, amount?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
}

function validateConfig(config: RateLimiterConfig): void {
  if (config.maxTokens <= 0) {
    throw new RateLimitError("maxTokens must be greater than 0");
  }
  if (config.refillRate <= 0) {
    throw new RateLimitError("refillRate must be greater than 0");
  }
  if (config.refillIntervalMs <= 0) {
    throw new RateLimitError("refillIntervalMs must be greater than 0");
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  validateConfig(config);

  const buckets = new Map<string, BucketState>();

  const getBucket = (userId: string): BucketState => {
    if (!buckets.has(userId)) {
      buckets.set(userId, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
      });
    }
    return buckets.get(userId)!;
  };

  const refill = (bucket: BucketState): void => {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / config.refillIntervalMs) * config.refillRate;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  };

  const createProgram = (userId: string, amount: number): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const bucket = getBucket(userId);
      refill(bucket);
      
      if (bucket.tokens >= amount) {
        bucket.tokens -= amount;
        return true;
      }
      return false;
    });

  const createGetRemainingProgram = (userId: string): Effect.Effect<number> =>
    Effect.gen(function* () {
      const bucket = getBucket(userId);
      refill(bucket);
      return bucket.tokens;
    });

  return {
    tryConsume(userId: string, amount: number = 1): boolean {
      if (amount <= 0) {
        throw new Error("amount must be greater than 0");
      }
      return Effect.runSync(createProgram(userId, amount));
    },
    getRemaining(userId: string): number {
      return Effect.runSync(createGetRemainingProgram(userId));
    },
    reset(userId: string): void {
      const bucket = getBucket(userId);
      bucket.tokens = config.maxTokens;
      bucket.lastRefill = Date.now();
    },
  };
}

export { RateLimitError };