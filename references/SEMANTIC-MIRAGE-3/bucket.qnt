// Informational Quint spec for the token-bucket rate limiter.
// Not executed by tests; used to design property tests.
//
// Variables:
//   tokens          — current balance, in real numbers (Quint uses int; we model fixed-point)
//   lastRefillMs    — timestamp of last refill action

module TokenBucket {
  // Parameters (constants in this spec; the TS impl injects them as BucketConfig)
  pure val capacity = 10
  pure val refillRatePerSec = 5
  pure val maxTimeStepMs = 1000

  var tokens: int
  var lastRefillMs: int

  // Compute tokens earned between two timestamps (truncated to int for spec).
  pure def earnedBetween(t0: int, t1: int): int = {
    if (t1 <= t0) 0
    else ((t1 - t0) * refillRatePerSec) / 1000
  }

  // Pure next-state for refill at time t.
  // Q5 analog: forgetting to bind one of the vars below would make the spec invalid.
  action refill(nowMs: int): bool = all {
    nowMs > lastRefillMs,
    tokens' = min(capacity, tokens + earnedBetween(lastRefillMs, nowMs)),
    lastRefillMs' = nowMs,
  }

  // Consume `k` tokens. Pre-refill so we don't deny when we just should refill.
  action consume(nowMs: int, k: int): bool = all {
    k > 0,
    nowMs >= lastRefillMs,
    val refilled = min(capacity, tokens + earnedBetween(lastRefillMs, nowMs))
    all {
      refilled >= k,
      tokens' = refilled - k,
      lastRefillMs' = nowMs,
    }
  }

  // Q5 analog: every var must be set in init.
  action init = all {
    tokens' = capacity,
    lastRefillMs' = 0,
  }

  // Q6 analog: stutter — keep all vars unchanged.
  action stutter = all {
    tokens' = tokens,
    lastRefillMs' = lastRefillMs,
  }

  // Step: nondeterministically refill, consume, or stutter.
  action step = any {
    nondet t = oneOf(1.to(maxTimeStepMs)); refill(lastRefillMs + t),
    nondet kt = oneOf(tuples(1.to(capacity), 1.to(maxTimeStepMs)))
      consume(lastRefillMs + kt._2, kt._1),
    stutter,
  }

  // Invariants
  val cap = tokens <= capacity
  val nonNegative = tokens >= 0
  val timeMonotone = lastRefillMs >= 0

  // Properties (would be checked by `quint run` or `quint verify`)
  // - cap, nonNegative, timeMonotone hold for all reachable states.
}
