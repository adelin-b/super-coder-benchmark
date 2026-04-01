/** BUG: Tokens never refill — once exhausted, permanently blocked */
export interface RateLimitConfig { maxTokens: number; refillRate: number; refillIntervalMs: number; }
export class RateLimitError extends Error { constructor(m: string) { super(m); this.name = 'RateLimitError'; } }

export function createRateLimiter(config: RateLimitConfig) {
  if (config.maxTokens < 1) throw new RateLimitError('maxTokens must be >= 1');
  if (config.refillRate < 1) throw new RateLimitError('refillRate must be >= 1');
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();
  function getBucket(key: string) {
    if (!buckets.has(key)) buckets.set(key, { tokens: config.maxTokens, lastRefill: Date.now() });
    // BUG: no refill logic
    return buckets.get(key)!;
  }
  return {
    tryConsume(key: string, tokens = 1): boolean {
      if (tokens < 1) throw new RateLimitError('tokens must be >= 1');
      const b = getBucket(key);
      if (b.tokens >= tokens) { b.tokens -= tokens; return true; }
      return false;
    },
    getRemaining(key: string): number { return getBucket(key).tokens; },
    reset(key: string) { buckets.delete(key); },
  };
}
