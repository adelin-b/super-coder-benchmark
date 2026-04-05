export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
}

export interface RateLimiterStatus {
  tokens: number;
  capacity: number;
}

export interface RateLimiter {
  allowRequest(userId: string, tokensToConsume?: number): boolean;
  reset(userId?: string): void;
  getStatus(userId: string): RateLimiterStatus;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (!Number.isFinite(config.capacity) || config.capacity <= 0) {
    throw new Error("capacity must be a positive number");
  }
  if (!Number.isFinite(config.refillRate) || config.refillRate <= 0) {
    throw new Error("refillRate must be a positive number");
  }

  const userBuckets = new Map<
    string,
    { tokens: number; lastRefillTime: number }
  >();

  function refillTokens(userId: string): void {
    const now = Date.now();
    if (!userBuckets.has(userId)) {
      userBuckets.set(userId, {
        tokens: config.capacity,
        lastRefillTime: now,
      });
      return;
    }

    const bucket = userBuckets.get(userId)!;
    const elapsedMs = now - bucket.lastRefillTime;
    const elapsedSeconds = elapsedMs / 1000;
    const tokensToAdd = elapsedSeconds * config.refillRate;

    bucket.tokens = Math.min(
      config.capacity,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefillTime = now;
  }

  return {
    allowRequest(userId: string, tokensToConsume: number = 1): boolean {
      if (!Number.isFinite(tokensToConsume) || tokensToConsume <= 0) {
        throw new Error("tokensToConsume must be a positive number");
      }

      refillTokens(userId);
      const bucket = userBuckets.get(userId)!;

      if (bucket.tokens >= tokensToConsume) {
        bucket.tokens -= tokensToConsume;
        return true;
      }

      return false;
    },

    reset(userId?: string): void {
      if (userId === undefined) {
        userBuckets.clear();
      } else {
        userBuckets.delete(userId);
      }
    },

    getStatus(userId: string): RateLimiterStatus {
      refillTokens(userId);
      const bucket = userBuckets.get(userId)!;
      return {
        tokens: bucket.tokens,
        capacity: config.capacity,
      };
    },
  };
}