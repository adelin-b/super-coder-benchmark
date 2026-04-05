export interface RateLimiterConfig {
  tokensPerSecond: number;
  maxBurstSize: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private userBuckets: Map<string, UserBucket> = new Map();

  constructor(config: RateLimiterConfig) {
    if (config.tokensPerSecond <= 0) {
      throw new Error("tokensPerSecond must be positive");
    }
    if (config.maxBurstSize <= 0) {
      throw new Error("maxBurstSize must be positive");
    }
    this.config = config;
  }

  allow(userId: string): boolean {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }

    const now = Date.now();
    let bucket = this.userBuckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxBurstSize,
        lastRefillTime: now,
      };
      this.userBuckets.set(userId, bucket);
    }

    const timeDeltaSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = timeDeltaSeconds * this.config.tokensPerSecond;
    bucket.tokens = Math.min(
      this.config.maxBurstSize,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefillTime = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  getRemaining(userId: string): number {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }

    const now = Date.now();
    const bucket = this.userBuckets.get(userId);

    if (!bucket) {
      return this.config.maxBurstSize;
    }

    const timeDeltaSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = timeDeltaSeconds * this.config.tokensPerSecond;
    const tokens = Math.min(
      this.config.maxBurstSize,
      bucket.tokens + tokensToAdd
    );

    return tokens;
  }

  reset(userId: string): void {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }
    this.userBuckets.delete(userId);
  }

  resetAll(): void {
    this.userBuckets.clear();
  }
}