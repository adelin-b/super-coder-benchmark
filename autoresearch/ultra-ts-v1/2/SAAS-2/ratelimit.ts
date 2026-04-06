export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export function createRateLimiter(config: RateLimiterConfig) {
  const { maxTokens, refillRate, refillIntervalMs } = config;

  if (maxTokens <= 0) {
    throw new RateLimitError('maxTokens must be greater than 0');
  }
  if (refillRate <= 0) {
    throw new RateLimitError('refillRate must be greater than 0');
  }
  if (refillIntervalMs <= 0) {
    throw new RateLimitError('refillIntervalMs must be greater than 0');
  }

  const buckets = new Map<string, UserBucket>();

  function refill(userId: string): void {
    let bucket = buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefillTime: Date.now() };
      buckets.set(userId, bucket);
      return;
    }

    const now = Date.now();
    const elapsed = now - bucket.lastRefillTime;
    const tokensToAdd = (elapsed / refillIntervalMs) * refillRate;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }

  return {
    tryConsume(userId: string, amount: number = 1): boolean {
      refill(userId);
      const bucket = buckets.get(userId)!;

      if (bucket.tokens >= amount) {
        bucket.tokens -= amount;
        return true;
      }
      return false;
    },

    getRemaining(userId: string): number {
      refill(userId);
      const bucket = buckets.get(userId)!;
      return Math.floor(bucket.tokens);
    },

    reset(userId: string): void {
      const bucket = buckets.get(userId);
      if (bucket) {
        bucket.tokens = maxTokens;
        bucket.lastRefillTime = Date.now();
      } else {
        buckets.set(userId, { tokens: maxTokens, lastRefillTime: Date.now() });
      }
    },
  };
}