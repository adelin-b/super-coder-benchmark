import { Effect, Data } from "effect";
import { Exit, Cause } from "effect";

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
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

class ValidationError extends Data.TaggedError("ValidationError")<{ reason: string }> {}

interface KeyState {
  bucketTokens: number;
  lastRefillMs: number;
  windowLog: number[];
}

function validatePolicy(policy: Policy): Effect.Effect<void, ValidationError> {
  return Effect.gen(function* () {
    if (policy.windowMax < 1) {
      yield* Effect.fail(new ValidationError({ reason: "windowMax must be >= 1" }));
    }
    if (policy.windowMs <= 0) {
      yield* Effect.fail(new ValidationError({ reason: "windowMs must be > 0" }));
    }
    if (policy.burstCapacity < 1) {
      yield* Effect.fail(new ValidationError({ reason: "burstCapacity must be >= 1" }));
    }
    if (policy.refillPerSec <= 0) {
      yield* Effect.fail(new ValidationError({ reason: "refillPerSec must be > 0" }));
    }
  });
}

function createInitialState(policy: Policy, nowMs: number): KeyState {
  return {
    bucketTokens: policy.burstCapacity,
    lastRefillMs: nowMs,
    windowLog: [],
  };
}

function refillBucket(state: KeyState, policy: Policy, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - state.lastRefillMs) / 1000;
  const refilled = elapsed * policy.refillPerSec;
  return Math.min(policy.burstCapacity, state.bucketTokens + refilled);
}

function pruneWindow(log: number[], windowMs: number, nowMs: number): number[] {
  const cutoff = nowMs - windowMs;
  return log.filter((t) => t > cutoff);
}

export function createSlidingWindowLimiter(policy: Policy): {
  check(key: string, nowMs: number): RateLimitResult;
  reset(key: string): void;
  inspect(key: string, nowMs: number): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  };
} {
  // Validate policy upfront
  const validationExit = Effect.runSyncExit(validatePolicy(policy));
  if (Exit.isFailure(validationExit)) {
    const raw = Cause.squash(validationExit.cause);
    const msg = raw instanceof Error ? raw.message : (raw as any).reason ?? String(raw);
    throw new RateLimitError(msg);
  }

  const stateMap = new Map<string, KeyState>();
  // Track the last seen time per key to handle clock skew
  const lastSeenMs = new Map<string, number>();

  function getOrCreateState(key: string, nowMs: number): { state: KeyState; effectiveNow: number } {
    const lastSeen = lastSeenMs.get(key);
    // Clamp to last seen time if clock goes backwards
    const effectiveNow = lastSeen !== undefined ? Math.max(lastSeen, nowMs) : nowMs;

    if (!stateMap.has(key)) {
      const state = createInitialState(policy, effectiveNow);
      stateMap.set(key, state);
    }

    return { state: stateMap.get(key)!, effectiveNow };
  }

  function check(key: string, nowMs: number): RateLimitResult {
    const { state, effectiveNow } = getOrCreateState(key, nowMs);

    // Update last seen
    lastSeenMs.set(key, effectiveNow);

    // Refill tokens based on elapsed time
    const newTokens = refillBucket(state, policy, effectiveNow);
    state.bucketTokens = newTokens;
    state.lastRefillMs = effectiveNow;

    // Prune old window entries
    state.windowLog = pruneWindow(state.windowLog, policy.windowMs, effectiveNow);

    const bucketAllowed = state.bucketTokens >= 1;
    const windowCount = state.windowLog.length;
    const windowAllowed = windowCount < policy.windowMax;

    if (bucketAllowed && windowAllowed) {
      // Consume token and record timestamp
      state.bucketTokens = state.bucketTokens - 1;
      state.windowLog.push(effectiveNow);

      return {
        allowed: true,
        tokensRemaining: Math.max(0, Math.min(policy.burstCapacity, state.bucketTokens)),
        windowRemaining: Math.max(0, policy.windowMax - state.windowLog.length),
        retryAfterMs: 0,
      };
    }

    // Denied — compute retryAfterMs
    let bucketWaitMs = 0;
    if (!bucketAllowed) {
      // Time until we have 1 token
      const tokensNeeded = 1 - state.bucketTokens;
      bucketWaitMs = Math.ceil((tokensNeeded / policy.refillPerSec) * 1000);
    }

    let windowWaitMs = 0;
    if (!windowAllowed) {
      // Time until oldest entry expires
      const oldest = state.windowLog[0]; // already pruned, smallest first
      if (oldest !== undefined) {
        const expiresAt = oldest + policy.windowMs;
        windowWaitMs = Math.max(0, expiresAt - effectiveNow);
        if (windowWaitMs === 0) windowWaitMs = 1; // ensure > 0 if truly denied
      }
    }

    const retryAfterMs = Math.max(bucketWaitMs, windowWaitMs);

    return {
      allowed: false,
      tokensRemaining: Math.max(0, Math.min(policy.burstCapacity, state.bucketTokens)),
      windowRemaining: Math.max(0, policy.windowMax - windowCount),
      retryAfterMs: retryAfterMs > 0 ? retryAfterMs : 1,
    };
  }

  function reset(key: string): void {
    stateMap.delete(key);
    lastSeenMs.delete(key);
  }

  function inspect(key: string, nowMs: number): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  } {
    if (!stateMap.has(key)) {
      return {
        bucketTokens: policy.burstCapacity,
        windowRequestCount: 0,
        oldestRequestMs: null,
      };
    }

    const { state, effectiveNow } = getOrCreateState(key, nowMs);

    // Compute current tokens after refill (without mutating state)
    const currentTokens = refillBucket(state, policy, effectiveNow);
    const prunedLog = pruneWindow(state.windowLog, policy.windowMs, effectiveNow);

    return {
      bucketTokens: Math.max(0, Math.min(policy.burstCapacity, currentTokens)),
      windowRequestCount: prunedLog.length,
      oldestRequestMs: prunedLog.length > 0 ? prunedLog[0] : null,
    };
  }

  return { check, reset, inspect };
}