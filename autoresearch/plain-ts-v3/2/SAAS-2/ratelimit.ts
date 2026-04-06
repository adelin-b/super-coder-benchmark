I need the test file to implement this correctly. According to my instructions, the test file is the source of truth for:

1. What to export (exact names and types)
2. Constructor/factory signatures
3. Method names and signatures
4. When errors should be thrown
5. Expected behavior

The spec "Token bucket rate limiter with per-user limits, burst capacity, and sliding window" is too brief to know whether the API should be:

- `createRateLimiter({ maxTokens, interval, burst? })`?
- `rateLimiter.tryConsume(userId, tokens)`?
- Should it return `boolean` or `{ allowed: boolean, remaining: number }`?
- What errors should be thrown, if any?

Please provide the test file (the `.test.ts` or `.spec.ts` file) so I can read the imports, method calls, and assertions to implement the exact API needed.