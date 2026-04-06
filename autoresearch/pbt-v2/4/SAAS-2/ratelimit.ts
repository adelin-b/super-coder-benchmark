export function createRateLimiter(config: {
  tokensPerSecond: number
  capacity: number
}) {
  if (config.tokensPerSecond <= 0 || config.capacity <= 0) {
    throw new Error("tokensPerSecond and capacity must be positive")
  }

  const buckets = new Map<
    string,
    { tokens: number; lastRefill: number }
  >()

  const refillBucket = (userId: string): void => {
    const now = Date.now()

    if (!buckets.has(userId)) {
      buckets.set(userId, {
        tokens: config.capacity,
        lastRefill: now,
      })
      return
    }

    const bucket = buckets.get(userId)!
    const elapsedSeconds = (now - bucket.lastRefill) / 1000
    const tokensToAdd = elapsedSeconds * config.tokensPerSecond

    bucket.tokens = Math.min(config.capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
  }

  return {
    canConsume(userId: string, tokens: number = 1): boolean {
      if (tokens <= 0) {
        throw new Error("tokens must be positive")
      }

      refillBucket(userId)
      const bucket = buckets.get(userId)!

      if (bucket.tokens >= tokens) {
        bucket.tokens -= tokens
        return true
      }

      return false
    },

    getRemaining(userId: string): number {
      refillBucket(userId)
      return buckets.get(userId)?.tokens ?? 0
    },

    reset(): void {
      buckets.clear()
    },

    resetUser(userId: string): void {
      buckets.delete(userId)
    },
  }
}