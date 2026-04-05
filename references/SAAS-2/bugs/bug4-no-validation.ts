/** BUG: No validation on config — allows maxTokens=0, refillRate=0 */
export interface RateLimitConfig { maxTokens: number; refillRate: number; refillIntervalMs: number; }
export class RateLimitError extends Error { constructor(m: string) { super(m); this.name = 'RateLimitError'; } }

export function createRateLimiter(config: RateLimitConfig) {
  // BUG: no validation
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();
  function getBucket(key: string) {
    if (!buckets.has(key)) buckets.set(key, { tokens: config.maxTokens, lastRefill: Date.now() });
    const b = buckets.get(key)!;
    const elapsed = Date.now() - b.lastRefill;
    const refills = Math.floor(elapsed / config.refillIntervalMs);
    if (refills > 0) {
      b.tokens = Math.min(config.maxTokens, b.tokens + refills * config.refillRate);
      b.lastRefill += refills * config.refillIntervalMs;
    }
    return b;
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
