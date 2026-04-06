interface RateLimiterConfig {
  tokensPerWindow: number;
  windowSizeMs: number;
  burstCapacity?: number;
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

interface RateLimiter {
  allow(userId: string, tokensNeeded?: number): boolean;
  reset(userId: string): void;
  getTokens(userId: string): number;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (!config || config.tokensPerWindow <= 0 || config.windowSizeMs <= 0) {
    throw new Error("Invalid rate limiter config");
  }

  const users = new Map<string, UserBucket>();
  const burstCapacity = config.burstCapacity ?? config.tokensPerWindow;

  if (burstCapacity <= 0) {
    throw new Error("Burst capacity must be positive");
  }

  function refillBucket(bucket: UserBucket, now: number): void {
    const elapsedMs = now - bucket.lastRefillTime;
    const refillRate = config.tokensPerWindow / config.windowSizeMs;
    const tokensToAdd = elapsedMs * refillRate;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, burstCapacity);
    bucket.lastRefillTime = now;
  }

  function allow(userId: string, tokensNeeded: number = 1): boolean {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId required");
    }

    if (tokensNeeded < 0 || !Number.isFinite(tokensNeeded)) {
      throw new Error("tokensNeeded must be non-negative");
    }

    const now = Date.now();
    let bucket = users.get(userId);

    if (!bucket) {
      bucket = {
        tokens: burstCapacity,
        lastRefillTime: now,
      };
      users.set(userId, bucket);
    }

    refillBucket(bucket, now);

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  function reset(userId: string): void {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId required");
    }
    users.delete(userId);
  }

  function getTokens(userId: string): number {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId required");
    }

    let bucket = users.get(userId);

    if (!bucket) {
      return burstCapacity;
    }

    const now = Date.now();
    refillBucket(bucket, now);
    return bucket.tokens;
  }

  return {
    allow,
    reset,
    getTokens,
  };
}