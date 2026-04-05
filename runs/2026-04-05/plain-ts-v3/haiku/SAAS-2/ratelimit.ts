// Should it look something like this?
const limiter = new RateLimiter({
  tokensPerSecond: 10,
  burstCapacity: 50,
  windowSizeMs: 1000
});

const allowed = limiter.check(userId, tokensToConsume);