interface RateLimitConfig {
  capacity: number;
  refillRate: number;
}

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private config: RateLimitConfig;
  private users: Map<string, RateLimitState>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.users = new Map();
  }

  private refillTokens(userId: string, now: number): number {
    const state = this.users.get(userId) || {
      tokens: this.config.capacity,
      lastRefill: now,
    };

    const timePassed = (now - state.lastRefill) / 1000;
    const tokensAdded = timePassed * this.config.refillRate;
    const newTokens = Math.min(
      state.tokens + tokensAdded,
      this.config.capacity
    );

    state.tokens = newTokens;
    state.lastRefill = now;

    this.users.set(userId, state);
    return newTokens;
  }

  isAllowed(userId: string, tokensNeeded: number = 1): boolean {
    const now = Date.now();
    const tokens = this.refillTokens(userId, now);

    if (tokens >= tokensNeeded) {
      const state = this.users.get(userId)!;
      state.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  getTokens(userId: string): number {
    const now = Date.now();
    return this.refillTokens(userId, now);
  }

  reset(userId: string): void {
    this.users.delete(userId);
  }

  resetAll(): void {
    this.users.clear();
  }
}

export { RateLimiter, RateLimitConfig, RateLimitState };