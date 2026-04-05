export interface RateLimiterConfig {
  rate: number; // tokens per second
  burst: number; // maximum tokens (burst capacity)
}

interface UserBucket {
  tokens: number;
  lastRefill: number; // timestamp in milliseconds
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets: Map<string, UserBucket>;

  constructor(config: RateLimiterConfig) {
    if (config.rate <= 0) {
      throw new RateLimitError('Rate must be greater than 0');
    }
    if (config.burst <= 0) {
      throw new RateLimitError('Burst capacity must be greater than 0');
    }
    this.config = config;
    this.buckets = new Map();
  }

  private refillBucket(bucket: UserBucket, now: number): void {
    const timePassed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = (timePassed / 1000) * this.config.rate;
    bucket.tokens = Math.min(
      this.config.burst,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;
  }

  private getBucket(userId: string, now: number): UserBucket {
    if (!userId || userId.trim() === '') {
      throw new RateLimitError('User ID cannot be empty');
    }

    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = {
        tokens: this.config.burst,
        lastRefill: now,
      };
      this.buckets.set(userId, bucket);
    } else {
      this.refillBucket(bucket, now);
    }
    return bucket;
  }

  isAllowed(userId: string, tokensNeeded: number = 1): boolean {
    if (tokensNeeded <= 0) {
      throw new RateLimitError('Tokens needed must be greater than 0');
    }

    const now = Date.now();
    const bucket = this.getBucket(userId, now);

    return bucket.tokens >= tokensNeeded;
  }

  consume(userId: string, tokensNeeded: number = 1): boolean {
    if (tokensNeeded <= 0) {
      throw new RateLimitError('Tokens needed must be greater than 0');
    }

    const now = Date.now();
    const bucket = this.getBucket(userId, now);

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return true;
    }
    return false;
  }

  remaining(userId: string): number {
    if (!userId || userId.trim() === '') {
      throw new RateLimitError('User ID cannot be empty');
    }

    const now = Date.now();
    const bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.config.burst;
    }

    const timePassed = Math.max(0, now - bucket.lastRefill);
    const tokensToAdd = (timePassed / 1000) * this.config.rate;
    return Math.min(this.config.burst, bucket.tokens + tokensToAdd);
  }

  reset(userId: string): void {
    if (!userId || userId.trim() === '') {
      throw new RateLimitError('User ID cannot be empty');
    }
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config);
}