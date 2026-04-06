interface RateLimiterOptions {
  capacity: number;
  refillRate: number;
}

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private capacity: number;
  private refillRate: number;
  private buckets: Map<string, TokenBucketState>;

  constructor(options: RateLimiterOptions) {
    if (options.capacity < 1) {
      throw new Error("capacity must be at least 1");
    }
    if (options.refillRate <= 0) {
      throw new Error("refillRate must be positive");
    }

    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.buckets = new Map();
  }

  isAllowed(userId: string, tokens: number = 1): boolean {
    if (tokens <= 0) {
      throw new Error("tokens must be positive");
    }

    const bucket = this.getOrCreateBucket(userId);
    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  getRemaining(userId: string): number {
    const bucket = this.buckets.get(userId);
    if (!bucket) {
      return this.capacity;
    }

    this.refillBucket(bucket);
    return bucket.tokens;
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  private getOrCreateBucket(userId: string): TokenBucketState {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, {
        tokens: this.capacity,
        lastRefill: Date.now(),
      });
    }
    return this.buckets.get(userId)!;
  }

  private refillBucket(bucket: TokenBucketState): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;
  }
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}