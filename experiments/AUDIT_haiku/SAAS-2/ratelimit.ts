interface RateLimitConfig {
  rate: number; // tokens per second
  burst?: number; // maximum tokens (default: rate)
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds until bucket refills
  retryAfter?: number; // milliseconds to wait if denied
}

class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly rate: number;
  private readonly burst: number;

  constructor(config: RateLimitConfig) {
    this.rate = config.rate;
    this.burst = config.burst ?? config.rate;
  }

  check(userId: string, cost: number = 1): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: this.burst,
        lastRefill: now,
      };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.rate;
    bucket.tokens = Math.min(this.burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= cost;

    if (allowed) {
      bucket.tokens -= cost;
      const timeToFull = (this.burst - bucket.tokens) / this.rate;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetIn: Math.ceil(timeToFull * 1000),
      };
    } else {
      const deficit = cost - bucket.tokens;
      const waitTime = deficit / this.rate;
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.ceil(this.burst / this.rate * 1000),
        retryAfter: Math.ceil(waitTime * 1000),
      };
    }
  }

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  resetAll(): void {
    this.buckets.clear();
  }

  getStatus(userId: string): TokenBucket | undefined {
    const bucket = this.buckets.get(userId);
    if (!bucket) return undefined;

    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.rate;
    const currentTokens = Math.min(this.burst, bucket.tokens + tokensToAdd);

    return {
      tokens: currentTokens,
      lastRefill: bucket.lastRefill,
    };
  }
}

export { RateLimiter, RateLimitConfig, RateLimitResult, TokenBucket };