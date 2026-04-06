interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

interface UserBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  // Validate config
  if (config.maxTokens <= 0) {
    throw new RateLimitError('maxTokens must be greater than 0');
  }
  if (config.refillRate <= 0) {
    throw new RateLimitError('refillRate must be greater than 0');
  }
  if (config.refillIntervalMs <= 0) {
    throw new RateLimitError('refillIntervalMs must be greater than 0');
  }

  const buckets: Map<string, UserBucket> = new Map();

  function refillBucket(bucket: UserBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const intervals = Math.floor(timePassed / config.refillIntervalMs);

    if (intervals > 0) {
      const tokensToAdd = intervals * config.refillRate;
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now - (timePassed % config.refillIntervalMs);
    }
  }

  function getBucket(userId: string): UserBucket {
    if (!buckets.has(userId)) {
      buckets.set(userId, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
      });
    }
    return buckets.get(userId)!;
  }

  return {
    tryConsume(userId: string, tokens: number = 1): boolean {
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
      return bucket.tokens;
    },

    reset(userId: string): void {
      buckets.set(userId, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
      });
    },
  };
}