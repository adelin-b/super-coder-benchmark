interface RateLimitConfig {
  tokensPerInterval: number;
  intervalMs: number;
  burstCapacity?: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private buckets: Map<string, UserBucket>;
  private burstCapacity: number;

  constructor(
    tokensPerInterval: number,
    intervalMs: number,
    burstCapacity?: number
  ) {
    if (tokensPerInterval <= 0) {
      throw new Error("tokensPerInterval must be greater than 0");
    }
    if (intervalMs <= 0) {
      throw new Error("intervalMs must be greater than 0");
    }

    this.config = { tokensPerInterval, intervalMs, burstCapacity };
    this.burstCapacity = burstCapacity ?? tokensPerInterval;
    this.buckets = new Map();
  }

  isAllowed(userId: string, tokensNeeded: number = 1): boolean {
    if (!userId) {
      throw new Error("userId cannot be empty");
    }
    if (tokensNeeded <= 0) {
      throw new Error("tokensNeeded must be greater than 0");
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.burstCapacity,
        lastRefillTime: now
      };
      this.buckets.set(userId, bucket);
    }

    // Calculate tokens to add based on elapsed time
    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd =
      (timePassed / this.config.intervalMs) * this.config.tokensPerInterval;

    bucket.tokens = Math.min(this.burstCapacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  getRemainingTokens(userId: string): number {
    if (!userId) {
      throw new Error("userId cannot be empty");
    }

    const now = Date.now();
    const bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.burstCapacity;
    }

    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd =
      (timePassed / this.config.intervalMs) * this.config.tokensPerInterval;

    return Math.min(this.burstCapacity, bucket.tokens + tokensToAdd);
  }

  reset(userId: string): void {
    if (!userId) {
      throw new Error("userId cannot be empty");
    }
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}

export interface RateLimiterConfig {
  tokensPerInterval: number;
  intervalMs: number;
  burstCapacity?: number;
}

export function createRateLimiter(
  tokensPerInterval: number,
  intervalMs: number,
  burstCapacity?: number
): RateLimiter {
  return new RateLimiter(tokensPerInterval, intervalMs, burstCapacity);
}