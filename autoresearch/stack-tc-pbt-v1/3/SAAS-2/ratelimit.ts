interface RateLimiterConfig {
  capacity: number;
  refillRate: number; // tokens per second
}

interface UserBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private capacity: number;
  private refillRate: number;
  private buckets: Map<string, UserBucket>;
  private userLimits: Map<string, RateLimiterConfig>;

  constructor(capacity: number, refillRate: number) {
    if (capacity < 1) throw new Error("Capacity must be at least 1");
    if (refillRate <= 0) throw new Error("Refill rate must be positive");

    this.capacity = capacity;
    this.refillRate = refillRate;
    this.buckets = new Map();
    this.userLimits = new Map();
  }

  setUserLimit(userId: string, capacity: number, refillRate: number): void {
    if (capacity < 1) throw new Error("Capacity must be at least 1");
    if (refillRate <= 0) throw new Error("Refill rate must be positive");

    this.userLimits.set(userId, { capacity, refillRate });
  }

  isAllowed(userId: string, tokens: number = 1): boolean {
    if (tokens < 1) throw new Error("Tokens must be at least 1");

    const now = Date.now() / 1000; // seconds
    const config = this.userLimits.get(userId) || {
      capacity: this.capacity,
      refillRate: this.refillRate,
    };

    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: config.capacity, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * config.refillRate;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if enough tokens available
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  getRemainingTokens(userId: string): number {
    const now = Date.now() / 1000;
    const config = this.userLimits.get(userId) || {
      capacity: this.capacity,
      refillRate: this.refillRate,
    };

    let bucket = this.buckets.get(userId);

    if (!bucket) {
      return config.capacity;
    }

    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * config.refillRate;
    const current = Math.min(config.capacity, bucket.tokens + tokensToAdd);

    return current;
  }

  reset(userId?: string): void {
    if (userId) {
      this.buckets.delete(userId);
    } else {
      this.buckets.clear();
    }
  }
}

export { RateLimiter };
export type { RateLimiterConfig };