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

  // --- Hard edge cases ---

  it('partial token refill: fractional tokens do not round up to 1', () => {
    // refillPerSec=1 means 1 token per 1000ms. After 500ms only 0.5 tokens
    // have refilled — not enough for a request (need >= 1).
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 10000, burstCapacity: 1, refillPerSec: 1 });
    lim.check('u1', 1000); // consume the 1 token
    // 500ms later: 0.5 tokens refilled — should still be denied
    const r = lim.check('u1', 1500);
    expect(r.allowed).toBe(false);
    // Fractional tokens accumulate but are not enough for a request
    expect(r.tokensRemaining).toBeGreaterThanOrEqual(0);
    expect(r.tokensRemaining).toBeLessThan(1);
  });

  it('token refill caps at burstCapacity even after long idle', () => {
    // After a very long pause, tokens should cap at burstCapacity, not exceed it.
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 1000, burstCapacity: 3, refillPerSec: 10 });
    lim.check('u1', 0); // consume 1, now 2
    // 10 seconds later: would refill 100 tokens, but cap is 3
    const info = lim.inspect('u1', 10000);
    expect(info.bucketTokens).toBe(3);
  });

  it('denied request does NOT record timestamp in window log', () => {
    // A denied request must not be recorded — otherwise window fills up
    // with phantom entries.
    const lim = createSlidingWindowLimiter({ windowMax: 2, windowMs: 1000, burstCapacity: 1, refillPerSec: 1 });
    lim.check('u1', 1000); // allowed, bucket=0, window=1
    lim.check('u1', 1000); // denied (no tokens), window should still be 1
    lim.check('u1', 1000); // denied again
    const info = lim.inspect('u1', 1000);
    expect(info.windowRequestCount).toBe(1); // only the 1 allowed request
  });

  it('clock skew: backward time does not refill tokens or expire window entries', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 10, windowMs: 500, burstCapacity: 2, refillPerSec: 1 });
    lim.check('u1', 2000); // allowed, bucket=1
    lim.check('u1', 2000); // allowed, bucket=0
    // Go backward to 1500 — should be clamped to 2000, no refill
    const r = lim.check('u1', 1500);
    expect(r.allowed).toBe(false);
    // Window entries should not be pruned by the "earlier" time
    const info = lim.inspect('u1', 1500);
    expect(info.windowRequestCount).toBe(2);
  });

  it('retryAfterMs for bucket-limited request accounts for fractional tokens already refilled', () => {
    // refillPerSec=2 → 1 token every 500ms. Bucket=1, drain it, then wait 200ms.
    // At that point 0.4 tokens have refilled, need 0.6 more → 300ms.
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 10000, burstCapacity: 1, refillPerSec: 2 });
    lim.check('u1', 1000); // bucket=0
    const r = lim.check('u1', 1200); // 200ms later, 0.4 tokens refilled
    expect(r.allowed).toBe(false);
    // Need 0.6 tokens at 2/sec = 300ms
    expect(r.retryAfterMs).toBe(300);
  });

  it('window remaining decrements correctly and reaches zero', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 3, windowMs: 1000, burstCapacity: 100, refillPerSec: 100 });
    const r1 = lim.check('u1', 1000);
    expect(r1.windowRemaining).toBe(2);
    const r2 = lim.check('u1', 1000);
    expect(r2.windowRemaining).toBe(1);
    const r3 = lim.check('u1', 1000);
    expect(r3.windowRemaining).toBe(0);
    const r4 = lim.check('u1', 1000);
    expect(r4.allowed).toBe(false);
    expect(r4.windowRemaining).toBe(0);
  });

  it('inspect reflects token refill without consuming tokens', () => {
    // inspect should show refilled tokens but not consume any.
    const lim = createSlidingWindowLimiter({ windowMax: 100, windowMs: 10000, burstCapacity: 2, refillPerSec: 2 });
    lim.check('u1', 1000); // bucket=1
    lim.check('u1', 1000); // bucket=0
    // 500ms later: 1 token refilled
    const info1 = lim.inspect('u1', 1500);
    expect(info1.bucketTokens).toBe(1);
    // inspect again at same time: still 1 (not consumed by first inspect)
    const info2 = lim.inspect('u1', 1500);
    expect(info2.bucketTokens).toBe(1);
    // Now check (consume) — should be allowed
    const r = lim.check('u1', 1500);
    expect(r.allowed).toBe(true);
    expect(r.tokensRemaining).toBe(0);
  });

  it('reset one key does not affect another key', () => {
    const lim = createSlidingWindowLimiter({ windowMax: 5, windowMs: 1000, burstCapacity: 2, refillPerSec: 1 });
    lim.check('u1', 1000);
    lim.check('u2', 1000);
    lim.reset('u1');
    // u1 should be fresh
    const info1 = lim.inspect('u1', 1000);
    expect(info1.bucketTokens).toBe(2);
    expect(info1.windowRequestCount).toBe(0);
    // u2 should be unchanged
    const info2 = lim.inspect('u2', 1000);
    expect(info2.bucketTokens).toBe(1);
    expect(info2.windowRequestCount).toBe(1);
  });
});
