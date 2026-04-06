export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private maxTokens: number;
  private refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    if (maxTokens < 1) throw new Error("maxTokens must be at least 1");
    if (refillRate <= 0) throw new Error("refillRate must be positive");
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
  }

  private getBucket(userId: string) {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
      });
    }
    return this.buckets.get(userId)!;
  }

  private refillTokens(bucket: { tokens: number; lastRefill: number }) {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  public tryConsume(userId: string, tokens: number = 1): boolean {
    if (tokens < 0) throw new Error("tokens must be non-negative");
    const bucket = this.getBucket(userId);
    this.refillTokens(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }
    return false;
  }

  public getRemaining(userId: string): number {
    const bucket = this.getBucket(userId);
    this.refillTokens(bucket);
    return Math.floor(bucket.tokens);
  }

  public reset(userId: string): void {
    this.buckets.set(userId, {
      tokens: this.maxTokens,
      lastRefill: Date.now(),
    });
  }
}