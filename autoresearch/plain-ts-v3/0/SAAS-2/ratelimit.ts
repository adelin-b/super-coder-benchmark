export interface RateLimitConfig {
  rate: number; // tokens per second
  capacity: number; // max tokens (burst capacity)
}

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private config: RateLimitConfig;
  private buckets: Map<string, TokenBucket>;

  constructor(config: RateLimitConfig) {
    if (config.rate <= 0) {
      throw new RateLimitError('Rate must be positive');
    }
    if (config.capacity <= 0) {
      throw new RateLimitError('Capacity must be positive');
    }
    this.config = config;
    this.buckets = new Map();
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timePassed = (now - bucket.lastRefillTime) / 1000; // convert to seconds
    const tokensToAdd = timePassed * this.config.rate;
    bucket.tokens = Math.min(
      this.config.capacity,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefillTime = now;
  }

  private getBucket(userId: string): TokenBucket {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = {
        tokens: this.config.capacity,
        lastRefillTime: Date.now(),
      };
      this.buckets.set(userId, bucket);
    } else {
      this.refillBucket(bucket);
    }
    return bucket;
  }

  isAllowed(userId: string, tokensNeeded: number = 1): boolean {
    if (tokensNeeded <= 0) {
      throw new RateLimitError('Tokens needed must be positive');
    }
    if (userId === '') {
      throw new RateLimitError('User ID cannot be empty');
    }
    const bucket = this.getBucket(userId);
    return bucket.tokens >= tokensNeeded;
  }

  tryConsume(userId: string, tokensNeeded: number = 1): boolean {
    if (tokensNeeded <= 0) {
      throw new RateLimitError('Tokens needed must be positive');
    }
    if (userId === '') {
      throw new RateLimitError('User ID cannot be empty');
    }
    const bucket = this.getBucket(userId);
    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return true;
    }
    return false;
  }

  reset(userId: string): void {
    if (userId === '') {
      throw new RateLimitError('User ID cannot be empty');
    }
    this.buckets.delete(userId);
  }

  getTokens(userId: string): number {
    if (userId === '') {
      throw new RateLimitError('User ID cannot be empty');
    }
    const bucket = this.getBucket(userId);
    return bucket.tokens;
  }

  resetAll(): void {
    this.buckets.clear();
  }
}