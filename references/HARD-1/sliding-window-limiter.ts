export interface Policy {
  windowMax: number;
  windowMs: number;
  burstCapacity: number;
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  windowRemaining: number;
  retryAfterMs: number;
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RateLimitError';
  }
}

interface BucketState {
  tokens: number;
  lastCheckMs: number;
  windowLog: number[];
  lastSeenMs: number;
  roundsReadySkipped: number;
}

export function createSlidingWindowLimiter(policy: Policy) {
  if (policy.windowMax < 1) throw new RateLimitError('windowMax must be >= 1');
  if (policy.windowMs <= 0) throw new RateLimitError('windowMs must be > 0');
  if (policy.burstCapacity < 1) throw new RateLimitError('burstCapacity must be >= 1');
  if (policy.refillPerSec <= 0) throw new RateLimitError('refillPerSec must be > 0');

  const state = new Map<string, BucketState>();

  function getOrCreate(key: string, nowMs: number): BucketState {
    if (!state.has(key)) {
      state.set(key, {
        tokens: policy.burstCapacity,
        lastCheckMs: nowMs,
        windowLog: [],
        lastSeenMs: nowMs,
        roundsReadySkipped: 0,
      });
    }
    return state.get(key)!;
  }

  function clampTime(s: BucketState, nowMs: number): number {
    // Never go backwards
    return Math.max(nowMs, s.lastSeenMs);
  }

  function refillTokens(s: BucketState, nowMs: number): void {
    const elapsed = nowMs - s.lastCheckMs;
    if (elapsed > 0) {
      const refill = (elapsed / 1000) * policy.refillPerSec;
      s.tokens = Math.min(policy.burstCapacity, s.tokens + refill);
      s.lastCheckMs = nowMs;
    }
  }

  function pruneWindow(s: BucketState, nowMs: number): void {
    const cutoff = nowMs - policy.windowMs;
    // Remove entries older than or equal to cutoff (exclusive left boundary)
    while (s.windowLog.length > 0 && s.windowLog[0] <= cutoff) {
      s.windowLog.shift();
    }
  }

  return {
    check(key: string, nowMs: number): RateLimitResult {
      const s = getOrCreate(key, nowMs);
      const clamped = clampTime(s, nowMs);
      s.lastSeenMs = clamped;

      refillTokens(s, clamped);
      pruneWindow(s, clamped);

      const windowCount = s.windowLog.length;
      const hasToken = s.tokens >= 1;
      const hasWindow = windowCount < policy.windowMax;

      if (hasToken && hasWindow) {
        s.tokens -= 1;
        s.windowLog.push(clamped);
        return {
          allowed: true,
          tokensRemaining: Math.floor(s.tokens * 10000) / 10000, // avoid float noise
          windowRemaining: policy.windowMax - windowCount - 1,
          retryAfterMs: 0,
        };
      }

      // Denied - compute retryAfterMs
      let tokenWaitMs = 0;
      let windowWaitMs = 0;

      if (!hasToken) {
        // Time until next token: need (1 - fractional_tokens) / refillPerSec seconds
        const deficit = 1 - s.tokens;
        tokenWaitMs = Math.ceil((deficit / policy.refillPerSec) * 1000);
      }

      if (!hasWindow) {
        // Time until oldest entry expires from window
        if (s.windowLog.length > 0) {
          const oldest = s.windowLog[0];
          windowWaitMs = (oldest + policy.windowMs) - clamped;
          if (windowWaitMs <= 0) windowWaitMs = 1;
        }
      }

      const retryAfterMs = Math.max(tokenWaitMs, windowWaitMs);

      return {
        allowed: false,
        tokensRemaining: Math.max(0, Math.floor(s.tokens * 10000) / 10000),
        windowRemaining: Math.max(0, policy.windowMax - windowCount),
        retryAfterMs: retryAfterMs > 0 ? retryAfterMs : 1,
      };
    },

    reset(key: string): void {
      state.delete(key);
    },

    inspect(key: string, nowMs: number) {
      if (!state.has(key)) {
        return {
          bucketTokens: policy.burstCapacity,
          windowRequestCount: 0,
          oldestRequestMs: null as number | null,
        };
      }
      const s = state.get(key)!;
      const clamped = clampTime(s, nowMs);
      // Don't mutate on inspect - work on copies
      const elapsed = clamped - s.lastCheckMs;
      let tokens = s.tokens;
      if (elapsed > 0) {
        tokens = Math.min(policy.burstCapacity, tokens + (elapsed / 1000) * policy.refillPerSec);
      }
      const cutoff = clamped - policy.windowMs;
      const activeLog = s.windowLog.filter(t => t > cutoff);

      return {
        bucketTokens: Math.floor(tokens * 10000) / 10000,
        windowRequestCount: activeLog.length,
        oldestRequestMs: activeLog.length > 0 ? activeLog[0] : null,
      };
    },
  };
}
