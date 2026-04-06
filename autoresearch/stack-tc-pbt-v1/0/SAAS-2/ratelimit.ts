export interface RateLimiterConfig {
  /** Tokens per second refill rate */
  rate: number;
  /** Maximum burst capacity (max tokens in bucket) */
  capacity: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets: Map<string, UserBucket> = new Map();

  constructor(config: RateLimiterConfig) {
    if (!config || config.rate <= 0) {
      throw new Error("Rate must be positive");
    }
    if (!config || config.capacity <= 0) {
      throw new Error("Capacity must be positive");
    }
    this.config = config;
  }

  /**
   * Check if a request is allowed and consume tokens if allowed
   * @param userId - Unique user identifier
   * @param tokensRequested - Number of tokens to consume (default 1)
   * @returns true if request is allowed, false otherwise
   */
  isAllowed(userId: string, tokensRequested: number = 1): boolean {
    if (tokensRequested <= 0) {
      throw new Error("Tokens requested must be positive");
    }
    if (!userId) {
      throw new Error("userId must be non-empty string");
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.config.capacity,
        lastRefillTime: now,
      };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on elapsed time (sliding window)
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.rate;
    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;

    // Check if sufficient tokens available
    if (bucket.tokens >= tokensRequested) {
      bucket.tokens -= tokensRequested;
      return true;
    }

    return false;
  }

  /**
   * Get current available tokens for a user without consuming them
   * @param userId - Unique user identifier
   * @returns Current token count
   */
  getAvailableTokens(userId: string): number {
    if (!userId) {
      throw new Error("userId must be non-empty string");
    }

    const now = Date.now();
    const bucket = this.buckets.get(userId);

    if (!bucket) {
      return this.config.capacity;
    }

    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * this.config.rate;
    return Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
  }

  /**
   * Reset all users' rate limit state
   */
  reset(): void {
    this.buckets.clear();
  }

  /**
   * Reset a specific user's rate limit state
   * @param userId - Unique user identifier
   */
  resetUser(userId: string): void {
    if (!userId) {
      throw new Error("userId must be non-empty string");
    }
    this.buckets.delete(userId);
  }
}