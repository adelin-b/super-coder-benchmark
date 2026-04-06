interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number; // tokens per millisecond
}

interface RateLimiter {
  tryConsume(key: string): boolean;
  getRemaining(key: string): number;
  reset(key?: string): void;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (config.maxTokens <= 0) throw new Error("maxTokens must be positive");
  if (config.refillRate <= 0) throw new Error("refillRate must be positive");

  const userStates = new Map<string, { tokens: number; lastRefillTime: number }>();

  const calculateTokens = (key: string): number => {
    const now = Date.now();
    let state = userStates.get(key);

    if (!state) {
      state = { tokens: config.maxTokens, lastRefillTime: now };
      userStates.set(key, state);
      return config.maxTokens;
    }

    const elapsed = now - state.lastRefillTime;
    const tokensToAdd = elapsed * config.refillRate;
    state.tokens = Math.min(config.maxTokens, state.tokens + tokensToAdd);
    state.lastRefillTime = now;

    return state.tokens;
  };

  return {
    tryConsume(key: string): boolean {
      const tokens = calculateTokens(key);
      const state = userStates.get(key)!;

      if (tokens >= 1) {
        state.tokens -= 1;
        return true;
      }
      return false;
    },

    getRemaining(key: string): number {
      return Math.floor(calculateTokens(key));
    },

    reset(key?: string): void {
      const now = Date.now();
      if (key === undefined) {
        userStates.forEach((state) => {
          state.tokens = config.maxTokens;
          state.lastRefillTime = now;
        });
      } else {
        userStates.set(key, { tokens: config.maxTokens, lastRefillTime: now });
      }
    },
  };
}