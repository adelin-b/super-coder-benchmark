export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface Bucket {
  tokens: number;
  lastRefillTime: number;
}

export interface RateLimiter {
  tryConsume(userId: string, amount?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
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

  const buckets = new Map<string, Bucket>();

  function getBucket(userId: string): Bucket {
    if (!buckets.has(userId)) {
      buckets.set(userId, { tokens: maxTokens, lastRefillTime: Date.now() });
    }
    return buckets.get(userId)!;
  }

  function refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefillTime;
    const intervals = Math.floor(elapsed / refillIntervalMs);
    if (intervals > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + intervals * refillRate);
      bucket.lastRefillTime += intervals * refillIntervalMs;
    }
  }

  return {
    tryConsume(userId: string, amount = 1): boolean {
      const bucket = getBucket(userId);
      refill(bucket);
      if (bucket.tokens >= amount) {
        bucket.tokens -= amount;
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
      buckets.set(userId, { tokens: maxTokens, lastRefillTime: Date.now() });
    },
  };
}