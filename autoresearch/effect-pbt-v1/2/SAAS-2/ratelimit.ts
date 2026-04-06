import { Effect, Exit, Cause } from "effect";

interface RateLimiterConfig {
  capacity: number;      // burst capacity (max tokens)
  refillRate: number;    // tokens per second
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets: Map<string, UserBucket> = new Map();

  constructor(config: RateLimiterConfig) {
    if (config.capacity <= 0) {
      throw new Error("capacity must be positive");
    }
    if (config.refillRate <= 0) {
      throw new Error("refillRate must be positive");
    }
    this.config = config;
  }

  private refillBucket(bucket: UserBucket, now: number): void {
    const elapsed = (now - bucket.lastRefillTime) / 1000;
    const refilled = bucket.tokens + elapsed * this.config.refillRate;
    bucket.tokens = Math.min(refilled, this.config.capacity);
    bucket.lastRefillTime = now;
  }

  isAllowed(userId: string, tokensNeeded: number = 1): boolean {
    if (tokensNeeded <= 0) {
      throw new Error("tokensNeeded must be positive");
    }
    if (tokensNeeded > this.config.capacity) {
      throw new Error("tokensNeeded exceeds capacity");
    }

    const now = Date.now();
    const bucket = this.buckets.get(userId) || {
      tokens: this.config.capacity,
      lastRefillTime: now,
    };

    this.refillBucket(bucket, now);

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      this.buckets.set(userId, bucket);
      return true;
    }

    this.buckets.set(userId, bucket);
    return false;
  }

  consume(userId: string, tokensNeeded: number = 1): boolean {
    return this.isAllowed(userId, tokensNeeded);
  }

  getRemainingTokens(userId: string): number {
    const now = Date.now();
    const bucket = this.buckets.get(userId) || {
      tokens: this.config.capacity,
      lastRefillTime: now,
    };

    const elapsed = (now - bucket.lastRefillTime) / 1000;
    const refilled = bucket.tokens + elapsed * this.config.refillRate;
    return Math.min(refilled, this.config.capacity);
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}