/** BUG: All users share one bucket — no per-user isolation */
export interface RateLimitConfig { maxTokens: number; refillRate: number; refillIntervalMs: number; }
export class RateLimitError extends Error { constructor(m: string) { super(m); this.name = 'RateLimitError'; } }

export function createRateLimiter(config: RateLimitConfig) {
  if (config.maxTokens < 1) throw new RateLimitError('maxTokens must be >= 1');
  if (config.refillRate < 1) throw new RateLimitError('refillRate must be >= 1');
  // BUG: single global bucket instead of per-key
  let globalBucket = { tokens: config.maxTokens, lastRefill: Date.now() };

  function getBucket(_key: string) {
    const elapsed = Date.now() - globalBucket.lastRefill;
    const refills = Math.floor(elapsed / config.refillIntervalMs);
    if (refills > 0) {
      globalBucket.tokens = Math.min(config.maxTokens, globalBucket.tokens + refills * config.refillRate);
      globalBucket.lastRefill += refills * config.refillIntervalMs;
    }
    return globalBucket;
  }

  return {
    tryConsume(key: string, tokens = 1): boolean {
      if (tokens < 1) throw new RateLimitError('tokens must be >= 1');
      const b = getBucket(key);
      if (b.tokens >= tokens) { b.tokens -= tokens; return true; }
      return false;
    },
    getRemaining(key: string): number { return getBucket(key).tokens; },
    reset(_key: string) { globalBucket = { tokens: config.maxTokens, lastRefill: Date.now() }; },
  };
}
