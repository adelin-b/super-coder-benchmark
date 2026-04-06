import { Effect } from "effect";

interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface RateLimiter {
  tryConsume(tokens: number): boolean;
  getRemaining(): number;
  reset(): void;
  getCapacity(): number;
}

interface UserLimiterConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface UserLimiter {
  tryConsume(userId: string, tokens: number): boolean;
  getRemaining(userId: string): number;
  reset(userId: string): void;
  getCapacity(): number;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { maxTokens, refillRate } = config;

  if (maxTokens <= 0) throw new Error("maxTokens must be positive");
  if (refillRate <= 0) throw new Error("refillRate must be positive");

  let tokens = maxTokens;
  let lastRefillTime = Date.now();

  const refillTokens = () => {
    const now = Date.now();
    const elapsedSeconds = (now - lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * refillRate;
    tokens = Math.min(tokens + tokensToAdd, maxTokens);
    lastRefillTime = now;
  };

  return {
    tryConsume(amount: number): boolean {
      if (amount <= 0) throw new Error("amount must be positive");
      
      refillTokens();
      
      if (tokens >= amount) {
        tokens -= amount;
        return true;
      }
      return false;
    },

    getRemaining(): number {
      refillTokens();
      return tokens;
    },

    reset(): void {
      tokens = maxTokens;
      lastRefillTime = Date.now();
    },

    getCapacity(): number {
      return maxTokens;
    },
  };
}

export function createUserLimiter(config: UserLimiterConfig): UserLimiter {
  const { maxTokens, refillRate } = config;

  if (maxTokens <= 0) throw new Error("maxTokens must be positive");
  if (refillRate <= 0) throw new Error("refillRate must be positive");

  const limiters = new Map<string, RateLimiter>();

  const getOrCreateLimiter = (userId: string): RateLimiter => {
    if (!limiters.has(userId)) {
      limiters.set(userId, createRateLimiter({ maxTokens, refillRate }));
    }
    return limiters.get(userId)!;
  };

  return {
    tryConsume(userId: string, tokens: number): boolean {
      const limiter = getOrCreateLimiter(userId);
      return limiter.tryConsume(tokens);
    },

    getRemaining(userId: string): number {
      const limiter = getOrCreateLimiter(userId);
      return limiter.getRemaining();
    },

    reset(userId: string): void {
      const limiter = getOrCreateLimiter(userId);
      limiter.reset();
    },

    getCapacity(): number {
      return maxTokens;
    },
  };
}

export type { RateLimiterConfig, RateLimiter, UserLimiterConfig, UserLimiter };