export class RateLimiter {
  private tokensPerSecond: number;
  private capacity: number;
  private tokens: Map<string, number> = new Map();
  private lastRefillTime: Map<string, number> = new Map();

  constructor(tokensPerSecond: number, capacity: number) {
    if (tokensPerSecond <= 0) {
      throw new Error("tokensPerSecond must be positive");
    }
    if (capacity <= 0) {
      throw new Error("capacity must be positive");
    }
    if (capacity < tokensPerSecond) {
      throw new Error("capacity must be at least tokensPerSecond");
    }

    this.tokensPerSecond = tokensPerSecond;
    this.capacity = capacity;
  }

  allow(userId: string): boolean {
    const now = Date.now();
    const lastRefill = this.lastRefillTime.get(userId) ?? now;
    const elapsedSeconds = (now - lastRefill) / 1000;

    let tokens = this.tokens.get(userId) ?? this.capacity;
    tokens = Math.min(this.capacity, tokens + elapsedSeconds * this.tokensPerSecond);

    if (tokens >= 1) {
      this.tokens.set(userId, tokens - 1);
      this.lastRefillTime.set(userId, now);
      return true;
    }

    this.tokens.set(userId, tokens);
    this.lastRefillTime.set(userId, now);
    return false;
  }

  getRemaining(userId: string): number {
    const now = Date.now();
    const lastRefill = this.lastRefillTime.get(userId) ?? now;
    const elapsedSeconds = (now - lastRefill) / 1000;

    let tokens = this.tokens.get(userId) ?? this.capacity;
    tokens = Math.min(this.capacity, tokens + elapsedSeconds * this.tokensPerSecond);

    return Math.floor(tokens);
  }

  reset(userId?: string): void {
    if (userId) {
      this.tokens.delete(userId);
      this.lastRefillTime.delete(userId);
    } else {
      this.tokens.clear();
      this.lastRefillTime.clear();
    }
  }
}