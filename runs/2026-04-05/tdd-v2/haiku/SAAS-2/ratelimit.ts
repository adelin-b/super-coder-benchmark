interface UserTokenState {
  tokens: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private refillRate: number;
  private capacity: number;
  private userTokens: Map<string, UserTokenState> = new Map();

  constructor(refillRate: number, capacity: number) {
    this.refillRate = refillRate;
    this.capacity = capacity;
  }

  private refillTokens(userId: string): void {
    const now = Date.now();
    const state = this.userTokens.get(userId) || {
      tokens: this.capacity,
      lastRefillTime: now
    };

    const timePassed = (now - state.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
    state.lastRefillTime = now;

    this.userTokens.set(userId, state);
  }

  isAllowed(userId: string, tokens: number = 1): boolean {
    this.refillTokens(userId);
    const state = this.userTokens.get(userId)!;

    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return true;
    }
    return false;
  }

  getRemainingTokens(userId: string): number {
    this.refillTokens(userId);
    return this.userTokens.get(userId)?.tokens ?? this.capacity;
  }

  reset(userId: string): void {
    this.userTokens.delete(userId);
  }

  resetAll(): void {
    this.userTokens.clear();
  }
}

export function createRateLimiter(refillRate: number, capacity: number): RateLimiter {
  return new RateLimiter(refillRate, capacity);
}