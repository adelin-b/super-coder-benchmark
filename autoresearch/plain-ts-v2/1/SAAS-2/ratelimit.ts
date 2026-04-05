export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
  refillInterval?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private capacity: number;
  private refillRate: number;
  private refillInterval: number;
  private buckets: Map<string, TokenBucket>;

  constructor(config: RateLimiterConfig) {
    if (config.capacity < 1) {
      throw new RateLimitError('Capacity must be at least 1');
    }
    if (config.refillRate <= 0) {
      throw new RateLimitError('Refill rate must be positive');
    }
    if (config.refillInterval !== undefined && config.refillInterval <= 0) {
      throw new RateLimitError('Refill interval must be positive');
    }

    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.refillInterval = config.refillInterval || 1000;
    this.buckets = new Map();
  }

  private refillBucket(userId: string): void {
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefillTime: Date.now() };
      this.buckets.set(userId, bucket);
      return;
    }

    const now = Date.now();
    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd = (timePassed / this.refillInterval) * this.refillRate;

    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }

  tryConsume(userId: string, tokens: number = 1): boolean {
    if (tokens <= 0) {
      throw new RateLimitError('Token count must be positive');
    }

    this.refillBucket(userId);
    const bucket = this.buckets.get(userId)!;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  getRemaining(userId: string): number {
    this.refillBucket(userId);
    const bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.capacity;
    }

    return Math.floor(bucket.tokens);
  }

  reset(userId?: string): void {
    if (userId !== undefined) {
      this.buckets.delete(userId);
    } else {
      this.buckets.clear();
    }
  }

  size(): number {
    return this.buckets.size;
  }
}