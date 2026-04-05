interface RateLimiterConfig {
  tokensPerSecond: number;
  burstCapacity: number;
  windowDuration?: number;
}

class RateLimiter {
  constructor(config: RateLimiterConfig) { }
  checkLimit(userId: string): boolean { }
  // ... other methods
}