interface RateLimiterConfig {
  tokensPerWindow: number;
  windowSize: number;
  maxBurstSize?: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private buckets: Map<string, UserBucket>;

  constructor(config: RateLimiterConfig) {
    if (!Number.isFinite(config.tokensPerWindow) || config.tokensPerWindow <= 0) {
      throw new Error('tokensPerWindow must be a positive number');
    }
    if (!Number.isFinite(config.windowSize) || config.windowSize <= 0) {
      throw new Error('windowSize must be a positive number');
    }

    const maxBurstSize = config.maxBurstSize ?? config.tokensPerWindow;
    if (!Number.isFinite(maxBurstSize) || maxBurstSize <= 0) {
      throw new Error('maxBurstSize must be a positive number');
    }

    this.config = {
      tokensPerWindow: config.tokensPerWindow,
      windowSize: config.windowSize,
      maxBurstSize,
    };
    this.buckets = new Map();
  }

  private refillBucket(bucket: UserBucket, now: number): void {
    const elapsed = now - bucket.lastRefillTime;
    const windowsPassed = elapsed / this.config.windowSize;
    const tokensToAdd = windowsPassed * this.config.tokensPerWindow;
    bucket.tokens = Math.min(this.config.maxBurstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }

  allowRequest(userId: string): boolean {
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('userId must be a non-empty string');
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxBurstSize,
        lastRefillTime: now,
      };
      this.buckets.set(userId, bucket);
    }

    this.refillBucket(bucket, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  getRemainingTokens(userId: string): number {
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('userId must be a non-empty string');
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.config.maxBurstSize;
    }

    this.refillBucket(bucket, now);
    return bucket.tokens;
  }

  reset(userId?: string): void {
    if (userId === undefined) {
      this.buckets.clear();
    } else if (typeof userId === 'string') {
      this.buckets.delete(userId);
    } else {
      throw new Error('userId must be a string');
    }
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config);
}

export type { RateLimiterConfig };
export { RateLimiter };