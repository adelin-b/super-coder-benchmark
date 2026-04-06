export interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
}

export interface RateLimiter {
  tryConsume(userId: string, tokens?: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (config.maxTokens <= 0) {
    throw new Error("maxTokens must be greater than 0");
  }
  if (config.refillRate <= 0) {
    throw new Error("refillRate must be greater than 0");
  }

  const buckets = new Map<string, { tokens: number; lastRefillTime: number }>();

  const calculateTokens = (userId: string): number => {
    const bucket = buckets.get(userId);
    if (!bucket) {
      return config.maxTokens;
    }

    const now = Date.now();
    const timeElapsed = (now - bucket.lastRefillTime) / 1000;
    const tokensAdded = timeElapsed * config.refillRate;
    const newTokens = Math.min(
      config.maxTokens,
      bucket.tokens + tokensAdded
    );

    return newTokens;
  };

  return {
    tryConsume(userId: string, tokens: number = 1): boolean {
      if (tokens <= 0) {
        throw new Error("tokens must be greater than 0");
      }

      const currentTokens = calculateTokens(userId);

      if (currentTokens >= tokens) {
        const now = Date.now();
        buckets.set(userId, {
          tokens: currentTokens - tokens,
          lastRefillTime: now,
        });
        return true;
      }

      return false;
    },

    getRemaining(userId: string): number {
      return calculateTokens(userId);
    },

    reset(userId: string): void {
      buckets.delete(userId);
    },
  };
}