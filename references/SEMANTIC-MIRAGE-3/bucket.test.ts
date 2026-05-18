import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  refill,
  consume,
  createBucket,
  RateLimitedError,
  type BucketState,
  type BucketConfig,
} from './bucket.js';

const cfg: BucketConfig = { capacity: 10, refillRatePerSec: 5 };

describe('SEMANTIC-MIRAGE-3: token-bucket refill', () => {
  it('refill is pure: same args → deep-equal results (catches Q1: mutating impl)', () => {
    const s: BucketState = Object.freeze({ tokens: 4, lastRefillMs: 100 });
    const r1 = refill(s, 1100, cfg);
    const r2 = refill(s, 1100, cfg);
    expect(r1).toEqual(r2);
    expect(s).toEqual({ tokens: 4, lastRefillMs: 100 }); // unchanged
  });

  it('refill is idempotent: refill ∘ refill = refill (catches Q6: drops lastRefillMs)', () => {
    const s: BucketState = { tokens: 4, lastRefillMs: 100 };
    const once = refill(s, 1100, cfg);
    const twice = refill(once, 1100, cfg);
    expect(twice).toEqual(once);
  });

  it('refill caps at capacity', () => {
    const s: BucketState = { tokens: 0, lastRefillMs: 0 };
    const r = refill(s, 1_000_000, cfg);
    expect(r.tokens).toBe(cfg.capacity);
  });

  it('refill with nowMs <= lastRefillMs returns unchanged', () => {
    const s: BucketState = { tokens: 3, lastRefillMs: 500 };
    expect(refill(s, 500, cfg)).toEqual(s);
    expect(refill(s, 400, cfg)).toEqual(s);
  });

  it('refill does not mutate frozen input', () => {
    const s = Object.freeze({ tokens: 3, lastRefillMs: 0 }) as BucketState;
    expect(() => refill(s, 1000, cfg)).not.toThrow();
  });
});

describe('SEMANTIC-MIRAGE-3: token-bucket consume', () => {
  it('consume allowed: subtracts tokens, updates lastRefillMs (catches Q2: action without primed update)', () => {
    const s: BucketState = { tokens: 5, lastRefillMs: 100 };
    const r = consume(s, 100, cfg, 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.tokens).toBe(2);
      expect(r.state.lastRefillMs).toBe(100);
    }
  });

  it('consume denies when insufficient, computes retryAfterMs (catches Q6: dropped lastRefillMs)', () => {
    const s: BucketState = { tokens: 0, lastRefillMs: 0 };
    const r = consume(s, 0, cfg, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // need 5 tokens at 5 per second → 1000 ms
      expect(r.retryAfterMs).toBe(1000);
    }
  });

  it('retryAfterMs is accurate: replaying at now+retryAfterMs succeeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }), // starting tokens
        fc.integer({ min: 1, max: 10 }), // request size
        (start, k) => {
          const s: BucketState = { tokens: start, lastRefillMs: 0 };
          const first = consume(s, 0, cfg, k);
          if (k <= start) return first.ok === true;
          if (!first.ok) {
            if (first.retryAfterMs === Number.POSITIVE_INFINITY) return k > cfg.capacity;
            const replay = consume(s, first.retryAfterMs + 1, cfg, k);
            return replay.ok === true;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('consume throws RangeError on non-positive tokens', () => {
    const s: BucketState = { tokens: 5, lastRefillMs: 0 };
    expect(() => consume(s, 0, cfg, 0)).toThrow(RangeError);
    expect(() => consume(s, 0, cfg, -1)).toThrow(RangeError);
  });

  it('consume > capacity always denied with Infinity retry', () => {
    const s: BucketState = { tokens: 10, lastRefillMs: 0 };
    const r = consume(s, 0, cfg, cfg.capacity + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('consume is pure (same args → equal result)', () => {
    const s: BucketState = Object.freeze({ tokens: 3, lastRefillMs: 0 });
    const a = consume(s, 1000, cfg, 4);
    const b = consume(s, 1000, cfg, 4);
    expect(a).toEqual(b);
  });
});

describe('SEMANTIC-MIRAGE-3: token-bucket invariants (PBT)', () => {
  it('tokens always within [0, capacity]', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.integer({ min: 1, max: 5 }), // step ms increment
            fc.integer({ min: 1, max: cfg.capacity }), // request
          ),
          { maxLength: 50 },
        ),
        (steps) => {
          let s: BucketState = { tokens: cfg.capacity, lastRefillMs: 0 };
          let now = 0;
          for (const [dt, k] of steps) {
            now += dt;
            const r = consume(s, now, cfg, k);
            if (r.ok) s = r.state;
            if (s.tokens < 0 || s.tokens > cfg.capacity) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('SEMANTIC-MIRAGE-3: createBucket', () => {
  it('initial state uses clock.now() (catches Q5: forgot to bind lastRefillMs in init)', () => {
    const clock = { now: () => 12345 };
    const b = createBucket(cfg, clock);
    expect(b.snapshot()).toEqual({ tokens: cfg.capacity, lastRefillMs: 12345 });
  });

  it('tryConsume produces allowed/denied results consistent with snapshot', () => {
    let t = 0;
    const clock = { now: () => t };
    const b = createBucket(cfg, clock);
    // drain
    for (let i = 0; i < cfg.capacity; i++) {
      const r = b.tryConsume(1);
      expect(r.allowed).toBe(true);
    }
    const denied = b.tryConsume(1);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      // 1 token at 5/sec = 200 ms
      expect(denied.retryAfterMs).toBe(200);
    }
    // advance, retry
    t = denied.allowed ? 0 : (denied.retryAfterMs as number) + 1;
    const after = b.tryConsume(1);
    expect(after.allowed).toBe(true);
  });
});

describe('SEMANTIC-MIRAGE-3: RateLimitedError', () => {
  it('is an Error subclass and carries retryAfterMs', () => {
    const e = new RateLimitedError(500);
    expect(e).toBeInstanceOf(Error);
    expect(e.retryAfterMs).toBe(500);
    expect(e.message).toContain('500');
  });
});
