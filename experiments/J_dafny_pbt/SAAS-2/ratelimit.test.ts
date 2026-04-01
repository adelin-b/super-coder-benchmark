import { describe, it, expect } from 'vitest';
import { createRateLimiter, RateLimitError } from './ratelimit.js';

describe('SAAS-2: Rate Limiter', () => {
  it('allows requests within limit', () => {
    const rl = createRateLimiter({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(rl.tryConsume('u1')).toBe(true);
    expect(rl.getRemaining('u1')).toBe(4);
  });
  it('blocks when exhausted', () => {
    const rl = createRateLimiter({ maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 });
    expect(rl.tryConsume('u1')).toBe(true);
    expect(rl.tryConsume('u1')).toBe(true);
    expect(rl.tryConsume('u1')).toBe(false);
  });
  it('per-user isolation', () => {
    const rl = createRateLimiter({ maxTokens: 1, refillRate: 1, refillIntervalMs: 1000 });
    expect(rl.tryConsume('u1')).toBe(true);
    expect(rl.tryConsume('u1')).toBe(false);
    expect(rl.tryConsume('u2')).toBe(true); // different user
  });
  it('refills over time', () => {
    const rl = createRateLimiter({ maxTokens: 5, refillRate: 5, refillIntervalMs: 10 });
    rl.tryConsume('u1'); rl.tryConsume('u1'); rl.tryConsume('u1');
    return new Promise<void>(resolve => setTimeout(() => {
      expect(rl.getRemaining('u1')).toBeGreaterThan(2);
      resolve();
    }, 20));
  });
  it('burst then throttle', () => {
    const rl = createRateLimiter({ maxTokens: 3, refillRate: 1, refillIntervalMs: 100 });
    expect(rl.tryConsume('u1', 3)).toBe(true);
    expect(rl.tryConsume('u1')).toBe(false);
  });
  it('reset restores full capacity', () => {
    const rl = createRateLimiter({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    rl.tryConsume('u1', 5);
    expect(rl.getRemaining('u1')).toBe(0);
    rl.reset('u1');
    expect(rl.getRemaining('u1')).toBe(5);
  });
  it('throws on invalid config', () => {
    expect(() => createRateLimiter({ maxTokens: 0, refillRate: 1, refillIntervalMs: 1000 })).toThrow(RateLimitError);
  });
});
