export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfter?: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    if (config.maxTokens <= 0) {
      throw new Error('maxTokens must be greater than 0');
    }
    if (config.refillRate <= 0) {
      throw new Error('refillRate must be greater than 0');
    }

    this.config = {
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      refillInterval: config.refillInterval ?? 1000,
    };
  }

  private refillBucket(userId: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      this.buckets.set(userId, {
        tokens: this.config.maxTokens,
        lastRefill: now,
      });
      return;
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / this.config.refillInterval) * this.config.refillRate;
    
    bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  check(userId: string, tokensNeeded: number = 1): RateLimitResult {
    if (tokensNeeded <= 0) {
      throw new Error('tokensNeeded must be greater than 0');
    }

    this.refillBucket(userId);
    const bucket = this.buckets.get(userId)!;

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return {
        allowed: true,
        tokensRemaining: Math.floor(bucket.tokens),
      };
    }

    const tokensShortfall = tokensNeeded - bucket.tokens;
    const retryAfter = Math.ceil(
      (tokensShortfall / this.config.refillRate) * this.config.refillInterval
    );

    return {
      allowed: false,
      tokensRemaining: Math.floor(bucket.tokens),
      retryAfter,
    };
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }

  getStatus(userId: string): { tokens: number; lastRefill: number } | null {
    this.refillBucket(userId);
    const bucket = this.buckets.get(userId);
    return bucket
      ? {
          tokens: Math.floor(bucket.tokens),
          lastRefill: bucket.lastRefill,
        }
      : null;
  }
}