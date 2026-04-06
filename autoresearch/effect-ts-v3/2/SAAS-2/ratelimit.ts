import { Effect } from "effect";

export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
}

interface UserState {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private state: Map<string, UserState>;

  constructor(config: RateLimiterConfig) {
    if (config.capacity < 1) throw new Error("capacity must be at least 1");
    if (config.refillRate <= 0) throw new Error("refillRate must be positive");
    this.config = config;
    this.state = new Map();
  }

  private getOrInitState(userId: string): UserState {
    if (!this.state.has(userId)) {
      this.state.set(userId, {
        tokens: this.config.capacity,
        lastRefillTime: Date.now(),
      });
    }
    return this.state.get(userId)!;
  }

  private refillTokens(state: UserState): void {
    const now = Date.now();
    const elapsed = now - state.lastRefillTime;
    const tokensToAdd = elapsed * this.config.refillRate;
    state.tokens = Math.min(
      state.tokens + tokensToAdd,
      this.config.capacity
    );
    state.lastRefillTime = now;
  }

  tryConsume(userId: string, tokens: number = 1): boolean {
    if (userId === undefined || userId === null)
      throw new Error("userId is required");
    if (tokens <= 0) throw new Error("tokens must be positive");

    const state = this.getOrInitState(userId);
    this.refillTokens(state);

    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return true;
    }
    return false;
  }

  getRemaining(userId: string): number {
    if (userId === undefined || userId === null)
      throw new Error("userId is required");

    const state = this.getOrInitState(userId);
    this.refillTokens(state);
    return Math.floor(state.tokens);
  }

  reset(userId: string): void {
    if (userId === undefined || userId === null)
      throw new Error("userId is required");
    this.state.delete(userId);
  }
}

export function createRateLimiter(
  config: RateLimiterConfig
): RateLimiter {
  return new RateLimiter(config);
}