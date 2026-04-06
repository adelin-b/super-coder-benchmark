export interface RateLimiterConfig {
  tokensPerInterval: number;
  interval: number;
  maxBurst?: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimiterError';
  }
}

export function createRateLimiter(config: RateLimiterConfig) {
  if (!config || typeof config !== 'object') {
    throw new RateLimiterError('Config must be a valid object');
  }

  const { tokensPerInterval, interval, maxBurst } = config;

  if (tokensPerInterval <= 0 || !isFinite(tokensPerInterval)) {
    throw new RateLimiterError(
      'tokensPerInterval must be a positive finite number'
    );
  }

  if (interval <= 0 || !isFinite(interval)) {
    throw new RateLimiterError('interval must be a positive finite number');
  }

  if (maxBurst !== undefined && (maxBurst < 0 || !isFinite(maxBurst))) {
    throw new RateLimiterError('maxBurst must be a non-negative finite number');
  }

  const buckets: Map<string, UserBucket> = new Map();
  const burstCapacity = maxBurst ?? tokensPerInterval;

  function refillBucket(bucket: UserBucket, now: number): void {
    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd = (timePassed / interval) * tokensPerInterval;
    bucket.tokens = Math.min(burstCapacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }

  return {
    allowRequest(userId: string): boolean {
      const now = Date.now();
      let bucket = buckets.get(userId);

      if (!bucket) {
        bucket = {
          tokens: burstCapacity,
          lastRefillTime: now,
        };
        buckets.set(userId, bucket);
      }

      refillBucket(bucket, now);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }

      return false;
    },

    reset(userId?: string): void {
      if (userId) {
        buckets.delete(userId);
      } else {
        buckets.clear();
      }
    },

    getTokens(userId: string): number {
      const now = Date.now();
      let bucket = buckets.get(userId);

      if (!bucket) {
        return burstCapacity;
      }

      refillBucket(bucket, now);
      return bucket.tokens;
    },
  };
}