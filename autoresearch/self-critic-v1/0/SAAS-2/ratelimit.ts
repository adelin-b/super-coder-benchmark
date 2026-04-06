export interface RateLimiterConfig {
  tokensPerInterval: number;
  interval: 'second' | 'minute' | 'hour';
  maxTokens?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private tokensPerInterval: number;
  private intervalMs: number;
  private maxTokens: number;
  private buckets: Map<string, TokenBucket>;

  constructor(config: RateLimiterConfig) {
    if (config.tokensPerInterval <= 0) {
      throw new Error('tokensPerInterval must be positive');
    }

    this.tokensPerInterval = config.tokensPerInterval;

    const intervalMap: Record<string, number> = {
      second: 1000,
      minute: 60000,
      hour: 3600000
    };
    this.intervalMs = intervalMap[config.interval];
    this.maxTokens = config.maxTokens ?? config.tokensPerInterval;

    if (this.maxTokens <= 0) {
      throw new Error('maxTokens must be positive');
    }

    this.buckets = new Map();
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd = (timePassed / this.intervalMs) * this.tokensPerInterval;

    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.maxTokens);
    bucket.lastRefillTime = now;
  }

  isAllowed(userId: string, tokensRequired: number = 1): boolean {
    if (tokensRequired <= 0) {
      throw new Error('tokensRequired must be positive');
    }

    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefillTime: Date.now()
      };
      this.buckets.set(userId, bucket);
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      return true;
    }

    return false;
  }

  getRemainingTokens(userId: string): number {
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.maxTokens;
    }

    this.refillBucket(bucket);
    return Math.floor(bucket.tokens);
  }

  getResetTime(userId: string): number {
    const bucket = this.buckets.get(userId);

    if (!bucket) {
      return 0;
    }

    if (bucket.tokens >= this.maxTokens) {
      return 0;
    }

    const tokensNeeded = this.maxTokens - bucket.tokens;
    const timeNeeded = (tokensNeeded / this.tokensPerInterval) * this.intervalMs;

    return Math.ceil(timeNeeded);
  }

  reset(userId?: string): void {
    if (userId === undefined) {
      this.buckets.clear();
    } else {
      this.buckets.delete(userId);
    }
  }
}