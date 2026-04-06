export interface RateLimiterConfig {
  tokensPerInterval: number;
  interval: number;
  maxTokens?: number;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface UserBucket {
  tokens: number;
  lastRefillTime: number;
}

export function createRateLimiter(config: RateLimiterConfig) {
  if (!Number.isFinite(config.tokensPerInterval) || config.tokensPerInterval <= 0) {
    throw new RateLimitError('tokensPerInterval must be a positive finite number');
  }
  if (!Number.isFinite(config.interval) || config.interval <= 0) {
    throw new RateLimitError('interval must be a positive finite number');
  }

  const maxTokens = config.maxTokens ?? config.tokensPerInterval;
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new RateLimitError('maxTokens must be a positive finite number');
  }

  const buckets = new Map<string, UserBucket>();

  function refillTokens(bucket: UserBucket, now: number): number {
    const timePassed = now - bucket.lastRefillTime;
    const tokensToAdd = (timePassed / config.interval) * config.tokensPerInterval;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
    return bucket.tokens;
  }

  function allowRequest(userId: string, tokensNeeded: number = 1): boolean {
    if (!userId || typeof userId !== 'string') {
      throw new RateLimitError('userId must be a non-empty string');
    }
    if (!Number.isFinite(tokensNeeded) || tokensNeeded <= 0) {
      throw new RateLimitError('tokensNeeded must be a positive finite number');
    }

    const now = Date.now();
    let bucket = buckets.get(userId);

    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        lastRefillTime: now,
      };
      buckets.set(userId, bucket);
    }

    refillTokens(bucket, now);

    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  function tryConsume(userId: string, tokensNeeded: number = 1): boolean {
    return allowRequest(userId, tokensNeeded);
  }

  function getTokensRemaining(userId: string): number {
    if (!userId || typeof userId !== 'string') {
      throw new RateLimitError('userId must be a non-empty string');
    }

    const now = Date.now();
    let bucket = buckets.get(userId);

    if (!bucket) {
      return maxTokens;
    }

    refillTokens(bucket, now);
    return bucket.tokens;
  }

  function reset(userId?: string): void {
    if (userId !== undefined) {
      if (!userId || typeof userId !== 'string') {
        throw new RateLimitError('userId must be a non-empty string');
      }
      buckets.delete(userId);
    } else {
      buckets.clear();
    }
  }

  return {
    allowRequest,
    tryConsume,
    getTokensRemaining,
    reset,
  };
}