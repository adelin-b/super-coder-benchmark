export interface UserBucket {
  tokens: number
  lastRefillTime: number
}

export interface RateLimiterConfig {
  capacity: number
  refillRate: number
}

export class RateLimiter {
  private readonly buckets: Map<string, UserBucket> = new Map()
  private readonly capacity: number
  private readonly refillRate: number

  constructor(capacity: number, refillRate: number) {
    if (capacity <= 0) throw new Error("Capacity must be positive")
    if (refillRate <= 0) throw new Error("Refill rate must be positive")
    this.capacity = capacity
    this.refillRate = refillRate
  }

  private refillTokens(bucket: UserBucket, now: number): void {
    const timePassed = (now - bucket.lastRefillTime) / 1000
    const tokensToAdd = timePassed * this.refillRate
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefillTime = now
  }

  private getOrCreateBucket(userId: string): UserBucket {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, {
        tokens: this.capacity,
        lastRefillTime: Date.now(),
      })
    }
    return this.buckets.get(userId)!
  }

  isAllowed(userId: string, tokens: number = 1): boolean {
    const bucket = this.getOrCreateBucket(userId)
    const now = Date.now()
    this.refillTokens(bucket, now)
    return bucket.tokens >= tokens
  }

  consume(userId: string, tokens: number = 1): boolean {
    if (!this.isAllowed(userId, tokens)) {
      return false
    }
    const bucket = this.buckets.get(userId)!
    bucket.tokens -= tokens
    return true
  }

  remaining(userId: string): number {
    const bucket = this.getOrCreateBucket(userId)
    const now = Date.now()
    this.refillTokens(bucket, now)
    return bucket.tokens
  }

  reset(userId: string): void {
    this.buckets.delete(userId)
  }

  resetAll(): void {
    this.buckets.clear()
  }

  getConfig(): RateLimiterConfig {
    return {
      capacity: this.capacity,
      refillRate: this.refillRate,
    }
  }
}