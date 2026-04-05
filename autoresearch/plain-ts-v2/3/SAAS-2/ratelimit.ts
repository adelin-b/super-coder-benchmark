I need clarification on the rate limiter specification. You've provided a minimal spec ("Token bucket rate limiter with per-user limits, burst capacity, and sliding window") but without test imports or a detailed API specification, I can't determine:

1. **Factory function or class?** Should I export `createRateLimiter()` or a `RateLimiter` class?
2. **Core methods?** What should the API look like?
   - `checkLimit(userId, tokens?)` → boolean?
   - `reset(userId)` → void?
   - `getRemaining(userId)` → number?
   - Something else?
3. **Configuration?** 
   - How are `tokensPerSecond`, `burst capacity`, and `window` configured?
   - What are the defaults?
4. **Sliding window behavior?**
   - Time-based refill (e.g., 100 tokens/second)?
   - Expiring tokens older than the window?

Could you provide either:
- The test file imports (what the tests expect to import)
- A more detailed API specification
- Or example usage showing the expected behavior

Without this, I'd be guessing at the implementation.