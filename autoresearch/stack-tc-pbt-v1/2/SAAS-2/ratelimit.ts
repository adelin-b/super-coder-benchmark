interface RateLimiterConfig {
  tokensPerInterval: number;
  maxBurst: number;
  interval: number;
}

interface UserBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets: Map<string, UserBucket>;

  constructor(config: RateLimiterConfig) {
    if (config.tokensPerInterval <= 0) {
      throw new Error("tokensPerInterval must be positive");
    }
    if (config.maxBurst <= 0) {
      throw new Error("maxBurst must be positive");
    }
    if (config.interval <= 0) {
      throw new Error("interval must be positive");
    }

    this.config = config;
    this.buckets = new Map();
  }

  isAllowed(userId: string, tokens: number = 1): boolean {
    if (!userId) {
      throw new Error("userId must not be empty");
    }
    if (tokens <= 0) {
      throw new Error("tokens must be positive");
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxBurst,
        lastRefill: now,
      };
      this.buckets.set(userId, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const tokensToAdd =
      (elapsed / this.config.interval) * this.config.tokensPerInterval;
    bucket.tokens = Math.min(
      bucket.tokens + tokensToAdd,
      this.config.maxBurst
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}