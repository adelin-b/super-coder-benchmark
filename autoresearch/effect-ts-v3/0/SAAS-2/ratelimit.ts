export interface RateLimitConfig {
  tokensPerSecond: number;
  maxBurst: number;
}

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private configFn: (userId: string) => RateLimitConfig;

  constructor(configFn: (userId: string) => RateLimitConfig) {
    this.configFn = configFn;
  }

  private refillBucket(userId: string, now: number): TokenBucket {
    const config = this.configFn(userId);
    const bucket = this.buckets.get(userId) || {
      tokens: config.maxBurst,
      lastRefillTime: now,
    };

    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensGenerated = elapsedSeconds * config.tokensPerSecond;
    const newTokens = Math.min(config.maxBurst, bucket.tokens + tokensGenerated);

    const updatedBucket: TokenBucket = {
      tokens: newTokens,
      lastRefillTime: now,
    };

    this.buckets.set(userId, updatedBucket);
    return updatedBucket;
  }

  checkLimit(userId: string, tokensNeeded: number = 1): boolean {
    const now = Date.now();
    const bucket = this.refillBucket(userId, now);
    return bucket.tokens >= tokensNeeded;
  }

  consumeTokens(userId: string, tokensNeeded: number = 1): boolean {
    const now = Date.now();
    const bucket = this.refillBucket(userId, now);

    if (bucket.tokens >= tokensNeeded) {
      this.buckets.set(userId, {
        tokens: bucket.tokens - tokensNeeded,
        lastRefillTime: bucket.lastRefillTime,
      });
      return true;
    }

    return false;
  }

  getTokensRemaining(userId: string): number {
    const now = Date.now();
    const bucket = this.refillBucket(userId, now);
    return bucket.tokens;
  }

  reset(userId?: string): void {
    if (userId) {
      this.buckets.delete(userId);
    } else {
      this.buckets.clear();
    }
  }
}

export function createRateLimiter(
  configFn: (userId: string) => RateLimitConfig
): RateLimiter {
  return new RateLimiter(configFn);
}