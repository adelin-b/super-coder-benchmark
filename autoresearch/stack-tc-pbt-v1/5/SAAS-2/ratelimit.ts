interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
  window?: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

interface RateLimiter {
  allowRequest(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
  clear(): void;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (config.capacity < 1) {
    throw new Error("capacity must be at least 1");
  }
  if (config.refillRate <= 0) {
    throw new Error("refillRate must be greater than 0");
  }

  const buckets = new Map<string, UserBucket>();
  const capacity = config.capacity;
  const refillRate = config.refillRate;
  const window = config.window || 1000;

  function getCurrentTokens(userId: string): number {
    if (!buckets.has(userId)) {
      return capacity;
    }

    const bucket = buckets.get(userId)!;
    const now = Date.now();
    const timePassed = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * refillRate;
    const newTokens = Math.min(capacity, bucket.tokens + tokensToAdd);

    return newTokens;
  }

  return {
    allowRequest(userId: string, tokens: number = 1): boolean {
      if (tokens < 0) {
        throw new Error("tokens must be non-negative");
      }
      if (tokens === 0) {
        return true;
      }

      const now = Date.now();
      const currentTokens = getCurrentTokens(userId);

      if (currentTokens >= tokens) {
        const newTokenCount = currentTokens - tokens;
        buckets.set(userId, {
          tokens: newTokenCount,
          lastRefillTime: now,
        });
        return true;
      }

      return false;
    },

    getRemaining(userId: string): number {
      return Math.floor(getCurrentTokens(userId) * 100) / 100;
    },

    reset(userId: string): void {
      buckets.delete(userId);
    },

    clear(): void {
      buckets.clear();
    },
  };
}