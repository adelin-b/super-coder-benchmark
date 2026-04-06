import { Effect, Exit, Cause, Data } from "effect";

class RateLimitExceeded extends Data.TaggedError("RateLimitExceeded")<{
  userId: string;
  remaining: number;
}> {}

interface RateLimiterConfig {
  tokensPerSecond: number;
  burstCapacity: number;
}

interface UserTokenState {
  tokens: number;
  lastRefillAt: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private userStates: Map<string, UserTokenState>;

  constructor(config: RateLimiterConfig) {
    if (config.tokensPerSecond <= 0) {
      throw new Error("tokensPerSecond must be positive");
    }
    if (config.burstCapacity <= 0) {
      throw new Error("burstCapacity must be positive");
    }
    this.config = config;
    this.userStates = new Map();
  }

  private refillTokens(
    state: UserTokenState,
    now: number
  ): void {
    const timePassed = (now - state.lastRefillAt) / 1000; // convert ms to seconds
    const tokensToAdd = timePassed * this.config.tokensPerSecond;
    state.tokens = Math.min(
      state.tokens + tokensToAdd,
      this.config.burstCapacity
    );
    state.lastRefillAt = now;
  }

  allowRequest(userId: string, tokensToConsume: number = 1): boolean {
    if (tokensToConsume <= 0) {
      throw new Error("tokensToConsume must be positive");
    }

    const now = Date.now();
    let state = this.userStates.get(userId);

    if (!state) {
      state = {
        tokens: this.config.burstCapacity,
        lastRefillAt: now,
      };
      this.userStates.set(userId, state);
    }

    this.refillTokens(state, now);

    if (state.tokens >= tokensToConsume) {
      state.tokens -= tokensToConsume;
      return true;
    }

    return false;
  }

  remainingTokens(userId: string): number {
    const now = Date.now();
    let state = this.userStates.get(userId);

    if (!state) {
      return this.config.burstCapacity;
    }

    state = { ...state };
    this.refillTokens(state, now);
    return Math.floor(state.tokens);
  }

  reset(userId?: string): void {
    if (userId) {
      this.userStates.delete(userId);
    } else {
      this.userStates.clear();
    }
  }
}

export { RateLimitExceeded };