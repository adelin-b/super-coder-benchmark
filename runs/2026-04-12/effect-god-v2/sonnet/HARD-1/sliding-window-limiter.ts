import { Effect, Data, Exit, Cause } from "effect";

export interface Policy {
  /** Max requests in the sliding window */
  windowMax: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Token bucket capacity for bursts */
  burstCapacity: number;
  /** Token bucket refill rate (tokens per second) */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining in the bucket after this request */
  tokensRemaining: number;
  /** Requests remaining in the current window */
  windowRemaining: number;
  /** Milliseconds until next token is available (0 if allowed) */
  retryAfterMs: number;
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
  }
}

// ── Internal Effect layer ────────────────────────────────────────────────────

class PolicyValidationError extends Data.TaggedError("PolicyValidationError")<{
  reason: string;
}> {}

const validatePolicyEffect = (
  policy: Policy
): Effect.Effect<void, PolicyValidationError> =>
  Effect.gen(function* () {
    if (policy.windowMax < 1)
      yield* Effect.fail(
        new PolicyValidationError({ reason: "windowMax must be >= 1" })
      );
    if (policy.windowMs <= 0)
      yield* Effect.fail(
        new PolicyValidationError({ reason: "windowMs must be > 0" })
      );
    if (policy.burstCapacity < 1)
      yield* Effect.fail(
        new PolicyValidationError({ reason: "burstCapacity must be >= 1" })
      );
    if (policy.refillPerSec <= 0)
      yield* Effect.fail(
        new PolicyValidationError({ reason: "refillPerSec must be > 0" })
      );
  });

// ── Per-key mutable state ────────────────────────────────────────────────────

interface KeyState {
  /** Current token count */
  tokens: number;
  /** Last effective timestamp seen for this key (–Infinity before first use) */
  lastMs: number;
  /** Sorted log of timestamps for allowed requests (within the window) */
  log: number[];
}

// ── Public factory ───────────────────────────────────────────────────────────

export function createSlidingWindowLimiter(policy: Policy): {
  check(key: string, nowMs: number): RateLimitResult;
  reset(key: string): void;
  inspect(
    key: string,
    nowMs: number
  ): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  };
} {
  // Validate at construction time, converting Effect failure → RateLimitError
  const validationExit = Effect.runSyncExit(validatePolicyEffect(policy));
  if (Exit.isFailure(validationExit)) {
    const raw = Cause.squash(validationExit.cause);
    throw new RateLimitError(raw instanceof Error ? raw.message : String(raw));
  }

  const store = new Map<string, KeyState>();

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getOrInit(key: string): KeyState {
    let state = store.get(key);
    if (!state) {
      state = {
        tokens: policy.burstCapacity,
        lastMs: -Infinity,
        log: [],
      };
      store.set(key, state);
    }
    return state;
  }

  /**
   * Compute the effective "now", refill tokens in place, prune the log in
   * place, and return the effective timestamp.
   * Does NOT consume a token or append to the log.
   */
  function refreshState(state: KeyState, nowMs: number): number {
    // Clock-skew guard: never go backwards
    const effectiveNow =
      state.lastMs === -Infinity ? nowMs : Math.max(nowMs, state.lastMs);

    // Token bucket refill
    if (state.lastMs === -Infinity) {
      // First-ever access: tokens already at burstCapacity
    } else {
      const elapsedSec = (effectiveNow - state.lastMs) / 1000;
      const refilled = state.tokens + elapsedSec * policy.refillPerSec;
      state.tokens = Math.min(refilled, policy.burstCapacity);
    }
    state.lastMs = effectiveNow;

    // Prune log: keep only timestamps strictly inside the window
    // Window: (effectiveNow − windowMs, effectiveNow]  →  ts > cutoff
    const cutoff = effectiveNow - policy.windowMs;
    let pruneCount = 0;
    while (pruneCount < state.log.length && state.log[pruneCount] <= cutoff) {
      pruneCount++;
    }
    if (pruneCount > 0) state.log.splice(0, pruneCount);

    return effectiveNow;
  }

  // ── check ──────────────────────────────────────────────────────────────────

  function check(key: string, nowMs: number): RateLimitResult {
    const state = getOrInit(key);
    const effectiveNow = refreshState(state, nowMs);

    const bucketOk = state.tokens >= 1;
    const windowOk = state.log.length < policy.windowMax;
    const allowed = bucketOk && windowOk;

    if (allowed) {
      state.tokens -= 1;
      state.log.push(effectiveNow);
    }

    // retryAfterMs ────────────────────────────────────────────────────────────
    let retryAfterMs = 0;

    if (!allowed) {
      let maxWait = 0;

      if (!bucketOk) {
        // How long until tokens refill to ≥ 1?
        const tokensNeeded = 1 - state.tokens; // > 0
        const tokenWaitMs = (tokensNeeded / policy.refillPerSec) * 1000;
        if (tokenWaitMs > maxWait) maxWait = tokenWaitMs;
      }

      if (!windowOk) {
        // Oldest entry in the (already-pruned) log expires at log[0] + windowMs
        // We need log[0] + windowMs > effectiveNow (guaranteed by pruning)
        const windowWaitMs = state.log[0] + policy.windowMs - effectiveNow;
        if (windowWaitMs > maxWait) maxWait = windowWaitMs;
      }

      retryAfterMs = maxWait;
    }

    return {
      allowed,
      tokensRemaining: state.tokens,
      windowRemaining: Math.max(0, policy.windowMax - state.log.length),
      retryAfterMs,
    };
  }

  // ── reset ──────────────────────────────────────────────────────────────────

  function reset(key: string): void {
    store.delete(key);
  }

  // ── inspect ────────────────────────────────────────────────────────────────

  function inspect(
    key: string,
    nowMs: number
  ): {
    bucketTokens: number;
    windowRequestCount: number;
    oldestRequestMs: number | null;
  } {
    // Key never seen or was reset → pristine defaults
    if (!store.has(key)) {
      return {
        bucketTokens: policy.burstCapacity,
        windowRequestCount: 0,
        oldestRequestMs: null,
      };
    }

    const state = store.get(key)!;

    // Compute values without mutating store state
    const effectiveNow =
      state.lastMs === -Infinity ? nowMs : Math.max(nowMs, state.lastMs);

    // Projected token count after elapsed refill (read-only)
    let currentTokens: number;
    if (state.lastMs === -Infinity) {
      currentTokens = state.tokens;
    } else {
      const elapsedSec = (effectiveNow - state.lastMs) / 1000;
      currentTokens = Math.min(
        state.tokens + elapsedSec * policy.refillPerSec,
        policy.burstCapacity
      );
    }

    // Projected window entries (read-only filter)
    const cutoff = effectiveNow - policy.windowMs;
    const windowEntries = state.log.filter((ts) => ts > cutoff);

    return {
      bucketTokens: currentTokens,
      windowRequestCount: windowEntries.length,
      oldestRequestMs: windowEntries.length > 0 ? windowEntries[0] : null,
    };
  }

  return { check, reset, inspect };
}