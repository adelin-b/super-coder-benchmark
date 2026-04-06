import { describe, it, expect } from 'vitest';
import { createSlidingWindowLimiter, RateLimitError } from './sliding-window-limiter.js';

describe('HARD-1: Concurrent Sliding-Window Rate Limiter', () => {
  // --- Basic functionality ---
  it('allows requests within both limits', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 1000, burstCapacity: 5, refillPerSec: 1 });
    const r = lim.check('u1', 1000);
    expect(r.allowed).toBe(true);
    expect(r.retryAfterMs).toBe(0);
    expect(r.tokensRemaining).toBe(4);
    expect(r.windowRemaining).toBe(9);
  });

  it('blocks when token bucket is exhausted', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 1000, burstCapacity: 2, refillPerSec: 1 });
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(true);
    const r = lim.check('u1', 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('blocks when sliding window is full', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 2, windowMs: 1000, burstCapacity: 100, refillPerSec: 100 });
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(true);
    const r = lim.check('u1', 1000);
    expect(r.allowed).toBe(false);
  });

  it('refills tokens over time', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 10000, burstCapacity: 2, refillPerSec: 2 });
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(false);
    // After 1 second, 2 tokens should refill
    expect(lim.check('u1', 2000).allowed).toBe(true);
  });

  it('sliding window expires old entries', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 2, windowMs: 500, burstCapacity: 100, refillPerSec: 100 });
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(false);
    // After 500ms window expires
    expect(lim.check('u1', 1501).allowed).toBe(true);
  });

  // --- Per-key isolation ---
  it('different keys are independent', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 1, windowMs: 1000, burstCapacity: 1, refillPerSec: 1 });
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(false);
    expect(lim.check('u2', 1000).allowed).toBe(true);
  });

  // --- Reset ---
  it('reset restores full capacity', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 3, refillPerSec: 1 });
    lim.check('u1', 1000);
    lim.check('u1', 1000);
    lim.check('u1', 1000);
    expect(lim.check('u1', 1000).allowed).toBe(false);
    lim.reset('u1');
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).tokensRemaining).toBe(1);
  });

  it('inspect after reset returns defaults', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 3, refillPerSec: 1 });
    lim.check('u1', 1000);
    lim.reset('u1');
    const info = lim.inspect('u1', 2000);
    expect(info.bucketTokens).toBe(3);
    expect(info.windowRequestCount).toBe(0);
    expect(info.oldestRequestMs).toBeNull();
  });

  // --- retryAfterMs correctness ---
  it('retryAfterMs reflects token bucket wait when bucket-limited', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 10000, burstCapacity: 1, refillPerSec: 2 });
    lim.check('u1', 1000);
    const r = lim.check('u1', 1000);
    expect(r.allowed).toBe(false);
    // Need 1 token at 2/sec = 500ms
    expect(r.retryAfterMs).toBe(500);
  });

  it('retryAfterMs reflects window wait when window-limited', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 1, windowMs: 500, burstCapacity: 100, refillPerSec: 100 });
    lim.check('u1', 1000);
    const r = lim.check('u1', 1200);
    expect(r.allowed).toBe(false);
    // Oldest entry at 1000, window=500, expires at 1500, current=1200 -> wait 300ms
    expect(r.retryAfterMs).toBe(300);
  });

  it('retryAfterMs takes max when both limits hit', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 1, windowMs: 200, burstCapacity: 1, refillPerSec: 1 });
    lim.check('u1', 1000);
    const r = lim.check('u1', 1000);
    expect(r.allowed).toBe(false);
    // Token wait: 1/1 = 1000ms. Window wait: oldest=1000, expires=1200, now=1000 -> 200ms
    // Max = 1000ms
    expect(r.retryAfterMs).toBe(1000);
  });

  // --- Clock skew handling ---
  it('handles backward clock (clamp to last seen time)', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 1000, burstCapacity: 3, refillPerSec: 1 });
    lim.check('u1', 2000);
    lim.check('u1', 1500); // backward! clamped to 2000
    const info = lim.inspect('u1', 2000);
    expect(info.windowRequestCount).toBe(2);
  });

  // --- Concurrent/interleaved access ---
  it('handles rapid interleaved requests across keys', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 3, windowMs: 1000, burstCapacity: 2, refillPerSec: 1 });
    expect(lim.check('a', 100).allowed).toBe(true);
    expect(lim.check('b', 100).allowed).toBe(true);
    expect(lim.check('a', 100).allowed).toBe(true);
    expect(lim.check('b', 100).allowed).toBe(true);
    expect(lim.check('a', 100).allowed).toBe(false); // bucket empty for a
    expect(lim.check('b', 100).allowed).toBe(false); // bucket empty for b
    // a and b are independent, so window counts are separate
    const infoA = lim.inspect('a', 100);
    const infoB = lim.inspect('b', 100);
    expect(infoA.windowRequestCount).toBe(2);
    expect(infoB.windowRequestCount).toBe(2);
  });

  it('same timestamp multiple requests consume correctly', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 3, refillPerSec: 1 });
    const r1 = lim.check('u1', 5000);
    const r2 = lim.check('u1', 5000);
    const r3 = lim.check('u1', 5000);
    const r4 = lim.check('u1', 5000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false); // bucket exhausted
    expect(r3.tokensRemaining).toBe(0);
  });

  // --- Inspect ---
  it('inspect shows correct state without mutating', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 1000, burstCapacity: 5, refillPerSec: 2 });
    lim.check('u1', 1000);
    lim.check('u1', 1000);
    const info = lim.inspect('u1', 1000);
    expect(info.bucketTokens).toBe(3);
    expect(info.windowRequestCount).toBe(2);
    expect(info.oldestRequestMs).toBe(1000);
    // inspect again should give same result (non-mutating)
    const info2 = lim.inspect('u1', 1000);
    expect(info2.bucketTokens).toBe(3);
  });

  it('inspect for unseen key returns defaults', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 1000, burstCapacity: 5, refillPerSec: 2 });
    const info = lim.inspect('nobody', 5000);
    expect(info.bucketTokens).toBe(5);
    expect(info.windowRequestCount).toBe(0);
    expect(info.oldestRequestMs).toBeNull();
  });

  // --- Validation ---
  it('throws on windowMax < 1', () => {
    expect(() => createSlidingWindowLimiter({ windowMax: 0, windowMs: 1000, burstCapacity: 5, refillPerSec: 1 }))
      .toThrow(RateLimitError);
  });

  it('throws on windowMs <= 0', () => {
    expect(() => createSlidingWindowLimiter({ windowMax: 5, windowMs: 0, burstCapacity: 5, refillPerSec: 1 }))
      .toThrow(RateLimitError);
  });

  it('throws on burstCapacity < 1', () => {
    expect(() => createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 0, refillPerSec: 1 }))
      .toThrow(RateLimitError);
  });

  it('throws on refillPerSec <= 0', () => {
    expect(() => createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 5, refillPerSec: 0 }))
      .toThrow(RateLimitError);
  });

  // --- Window boundary transition ---
  it('window boundary: entry at exact boundary is excluded', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 1, windowMs: 100, burstCapacity: 100, refillPerSec: 100 });
    lim.check('u1', 1000);
    // At 1100, the entry at 1000 is at exactly (1100-100)=1000, exclusive left -> pruned
    const r = lim.check('u1', 1100);
    expect(r.allowed).toBe(true);
  });

  // --- Burst detection pattern ---
  it('detects sustained burst: bucket drains faster than window', () => {
    // burstCapacity=3, window allows 10 per 1000ms, refill 1/s
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 1000, burstCapacity: 3, refillPerSec: 1 });
    // Burst 3 at once
    expect(lim.check('u1', 0).allowed).toBe(true);
    expect(lim.check('u1', 0).allowed).toBe(true);
    expect(lim.check('u1', 0).allowed).toBe(true);
    expect(lim.check('u1', 0).allowed).toBe(false); // bucket empty
    // After 1 second: 1 token refilled
    expect(lim.check('u1', 1000).allowed).toBe(true);
    expect(lim.check('u1', 1000).allowed).toBe(false);
  });
});
