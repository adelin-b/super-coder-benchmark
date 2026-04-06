# Effect-God Agent: Research Report

**Date:** 2026-04-06
**Purpose:** Best practices for combining Effect TS + TDD + PBT + validation in AI code generation
**Target:** Effect v3.12+ / TypeScript 5.4+

---

## 1. Effect TS v3 Best Practices for AI-Generated Code

### 1.1 Module Structure for Testability

The recommended architecture separates concerns into three layers:

1. **Schema layer** -- Define domain types with `Schema.Struct`, `Schema.Class`, branded types
2. **Service layer** -- Business logic as Effect services with `Effect.Service` or `Context.Tag`
3. **Boundary layer** -- Plain TS exports wrapping Effect internals via `runSync`/`runPromise`

```typescript
// schema.ts -- pure data definitions
import { Schema } from "effect"

class UserId extends Schema.String.pipe(Schema.brand("UserId")) {}

const RateLimitConfig = Schema.Struct({
  maxTokens: Schema.Int.pipe(Schema.positive()),
  refillRate: Schema.Int.pipe(Schema.positive()),
  refillIntervalMs: Schema.Int.pipe(Schema.positive()),
})

// service.ts -- Effect-based business logic
class RateLimiterService extends Effect.Service<RateLimiterService>()("RateLimiter", {
  scoped: Effect.gen(function* () {
    // ... service implementation
  })
}) {}

// index.ts -- plain TS boundary
export function createRateLimiter(config: RateLimitConfigType) {
  return Effect.runSync(RateLimiterService.make(config))
}
```

**Key patterns from EffectPatterns repository (300+ patterns):**
- Use `Effect.gen` (generators) for business logic with conditionals
- Use `pipe()` for one-way data transformations
- Only one `Effect.provide` call per application, at the entry point
- Use `Effect.fn` for reusable functions with automatic tracing spans
- Use `as const` for type safety in service definitions

**Source:** [EffectPatterns on GitHub](https://github.com/PaulJPhilp/EffectPatterns), [Effect-TS Patterns (DeepWiki)](https://deepwiki.com/tim-smart/effect-mcp/5.2-effect-ts-patterns-and-best-practices)

### 1.2 Error Modeling

The canonical pattern uses `Data.TaggedError` for all domain errors:

```typescript
import { Data } from "effect"

class RateLimitExceeded extends Data.TaggedError("RateLimitExceeded")<{
  readonly userId: string
  readonly retryAfterMs: number
}> {}

class InvalidConfig extends Data.TaggedError("InvalidConfig")<{
  readonly field: string
  readonly reason: string
}> {}
```

**Why TaggedError:**
- Automatic `_tag` discriminant field for `catchTag`/`catchTags`
- Yieldable -- no need to wrap in `Effect.fail()`
- Structural equality via `Data` module
- Stack traces and cause chains preserved
- Works as both value and type

**Source:** [Effect Expected Errors docs](https://effect.website/docs/error-management/expected-errors/), [Effect Yieldable Errors docs](https://effect.website/docs/error-management/yieldable-errors/)

### 1.3 Import Style

```typescript
// Preferred: namespace imports for tree shaking
import { Effect, Schema, Data, Layer, Context } from "effect"
// NOT: import Effect from "effect/Effect"
```

**Source:** [dtech.vision Effect best practices](https://dtech.vision/blog/how-to-effect-ts-best-practices/)

---

## 2. TDD with Effect TS

### 2.1 The @effect/vitest Package

The `@effect/vitest` package provides first-class testing support:

```typescript
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"

// Basic effect test
it.effect("succeeds with value", () =>
  Effect.gen(function* () {
    const result = yield* Effect.succeed(42)
    expect(result).toBe(42)
  })
)

// Scoped test (automatic resource cleanup)
it.scoped("manages resources", () =>
  Effect.gen(function* () {
    const resource = yield* acquireResource
    // resource automatically released after test
  })
)

// Live clock (real time, not TestClock)
it.live("real timing", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBeGreaterThan(0)
  })
)
```

**Key test functions:**
| Function | Purpose |
|----------|---------|
| `it.effect()` | Standard Effect test with TestContext |
| `it.scoped()` | Effect test with scoped resource cleanup |
| `it.live()` | Test with real system clock |
| `it.layer()` | Share expensive layer across test suite |
| `it.effect.skip()` | Skip test |
| `it.effect.only()` | Run only this test |

**Source:** [Effect Solutions - Testing](https://www.effect.solutions/testing), [@effect/vitest on npm](https://www.npmjs.com/package/@effect/vitest)

### 2.2 Testing Time-Dependent Code

```typescript
import { TestClock, Fiber } from "effect"

it.effect("refills tokens over time", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.delay(refillTokens, "10 seconds")
      .pipe(Effect.forkChild)
    yield* TestClock.adjust("10 seconds")
    const result = yield* Fiber.join(fiber)
    expect(result).toBe(expectedTokens)
  })
)
```

### 2.3 Service Layer Testing with Mock Layers

```typescript
class Users extends Effect.Service<Users>()("Users") {
  // Production implementation
  static readonly Live = Layer.succeed(Users, { ... })

  // Test implementation with in-memory store
  static readonly Test = Layer.sync(Users, () => {
    const store = new Map()
    return {
      create: (user) => Effect.sync(() => void store.set(user.id, user)),
      findById: (id) => Effect.fromNullish(store.get(id))
    }
  })
}

// Compose test layers
const testLayer = Layer.mergeAll(Users.Test, Events.Test, Tickets.Test)

it.effect("creates user", () =>
  Effect.gen(function* () {
    const users = yield* Users
    yield* users.create({ id: "1", name: "Alice" })
    const found = yield* users.findById("1")
    expect(found.name).toBe("Alice")
  }).pipe(Effect.provide(testLayer))
)
```

**Best practice:** Provide a fresh layer inside each test so state never leaks. Use `it.layer` only for expensive shared resources.

### 2.4 Error Testing with Effect.flip

```typescript
it.effect("fails with InvalidConfig", () =>
  Effect.gen(function* () {
    const error = yield* createRateLimiter({ maxTokens: 0 }).pipe(Effect.flip)
    expect(error._tag).toBe("InvalidConfig")
  })
)
```

`Effect.flip` moves errors into the success channel, allowing direct assertions without try/catch.

**Source:** [DeepWiki Effect Testing](https://deepwiki.com/Effect-TS/effect/7.2-testing-and-property-based-testing)

### 2.5 TDD Red-Green-Refactor with Effect

The recommended cycle for AI code generation:

1. **RED:** Write the test first using `it.effect()` with expected behavior
2. **GREEN:** Generate minimal Effect implementation to pass
3. **REFACTOR:** Extract services, add Schema validation, compose layers
4. **VERIFY:** Run `vitest` to confirm green

For the AI agent, this means:
- Generate test file first (tests define the spec)
- Generate implementation targeting those tests
- Iterate with compiler feedback until green

---

## 3. Property-Based Testing with Effect

### 3.1 Schema-to-Arbitrary Pipeline

The killer feature: **any Effect Schema automatically becomes a fast-check arbitrary generator.**

```typescript
import { Arbitrary, Schema, FastCheck } from "effect"

const PersonSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  age: Schema.Int.pipe(Schema.between(1, 80))
})

// Automatic arbitrary generation!
const personArbitrary = Arbitrary.make(PersonSchema)

// Use in property tests
FastCheck.assert(
  FastCheck.property(personArbitrary, (person) => {
    // person.name is always non-empty
    // person.age is always 1-80
    return person.name.length > 0 && person.age >= 1 && person.age <= 80
  })
)
```

### 3.2 How Refinements Constrain Generators

- `Schema.Int.pipe(Schema.between(1, 80))` -> `fc.integer({ min: 1, max: 80 })`
- `Schema.NonEmptyString` -> non-empty string generator
- `Schema.pattern(/^[a-z]+$/)` -> `fc.stringMatching(/^[a-z]+$/)`

**Critical caveat:** "Filters applied before the last transformation in the transformation chain are not considered during generation." Always apply filters AFTER transformations.

### 3.3 Custom Arbitrary Annotations

Override generation for specific schemas:

```typescript
const CustomName = Schema.NonEmptyString.annotations({
  arbitrary: () => (fc) =>
    fc.constantFrom("Alice", "Bob", "Charlie")
})

// With faker
import { faker } from "@faker-js/faker"
const RealisticName = Schema.NonEmptyString.annotations({
  arbitrary: () => (fc) =>
    fc.constant(null).map(() => faker.person.fullName())
})
```

### 3.4 Property Testing Patterns for Domain Logic

```typescript
import { Arbitrary, Schema, FastCheck } from "effect"

// Define schemas
const ConfigSchema = Schema.Struct({
  maxTokens: Schema.Int.pipe(Schema.between(1, 1000)),
  refillRate: Schema.Int.pipe(Schema.between(1, 100)),
  refillIntervalMs: Schema.Int.pipe(Schema.between(10, 60000)),
})

const configArb = Arbitrary.make(ConfigSchema)
const userIdArb = Arbitrary.make(Schema.NonEmptyString)

// Property: consuming N tokens leaves maxTokens - N remaining
FastCheck.assert(
  FastCheck.property(configArb, userIdArb, (config, userId) => {
    const rl = createRateLimiter(config)
    const consumed = Math.min(3, config.maxTokens)
    for (let i = 0; i < consumed; i++) rl.tryConsume(userId)
    return rl.getRemaining(userId) === config.maxTokens - consumed
  })
)
```

**Source:** [Effect Schema Arbitrary docs](https://effect.website/docs/schema/arbitrary/), [fast-check GitHub](https://github.com/dubzzz/fast-check)

### 3.5 Best Practice Sequence for Schema + Arbitrary

1. Define schemas with constraints (between, positive, nonEmpty)
2. Apply filters to input type first
3. Define transformations
4. Apply filters to output type
5. Call `Arbitrary.make(schema)` for test generation
6. Write property tests using generated arbitraries

---

## 4. Effect TS Boundary Patterns (Plain Exports)

### 4.1 The Problem

Effect code internally uses `Effect<A, E, R>` types. External consumers (tests, other modules) often want plain TypeScript interfaces. The boundary pattern bridges this gap.

### 4.2 Recommended Boundary Pattern

```typescript
// internal.ts -- pure Effect code
export const tryConsumeEffect = (
  userId: string,
  tokens?: number
): Effect.Effect<boolean, RateLimitExceeded | InvalidConfig> =>
  Effect.gen(function* () {
    // ... Effect-based implementation
  })

// index.ts -- plain TS boundary
export function tryConsume(userId: string, tokens?: number): boolean {
  const exit = Effect.runSyncExit(tryConsumeEffect(userId, tokens))
  if (Exit.isSuccess(exit)) return exit.value
  const error = Cause.failureOption(exit.cause)
  if (Option.isSome(error)) {
    // Re-throw as plain Error subclass to preserve identity
    throw toPlainError(error.value)
  }
  throw new Error("Unexpected defect")
}

// Error mapping preserves class identity
function toPlainError(effectError: RateLimitExceeded | InvalidConfig): Error {
  switch (effectError._tag) {
    case "RateLimitExceeded":
      return new RateLimitError(`Rate limit exceeded for ${effectError.userId}`)
    case "InvalidConfig":
      return new ConfigError(`Invalid config: ${effectError.field} - ${effectError.reason}`)
  }
}
```

### 4.3 When to Use Which Runner

| Runner | Use When | Gotcha |
|--------|----------|--------|
| `Effect.runSync` | Purely synchronous, infallible | Throws on async or failure |
| `Effect.runSyncExit` | Synchronous, need to inspect errors | Returns Exit, no throw |
| `Effect.runPromise` | Async code, ok with rejection | Rejects on failure |
| `Effect.runPromiseExit` | Async, need to inspect errors | Returns Promise<Exit> |
| `ManagedRuntime` | Framework integration (React, Express) | Needs dispose() |

### 4.4 Harbor's Critique and the Mitigation

Harbor (2025) identified that Effect boundaries become "scattered integration plumbing" when every DB transaction, API handler, and auth strategy needs `runSync`/`runPromise`. Their recommendation: adopt Effect only in domains where the full type-safety benefit justifies the boundary cost.

**For AI code generation, the mitigation is:**
- Keep Effect internal to the module
- Export a plain TS facade (the "boundary wrapper")
- Tests can test EITHER the Effect internals OR the plain facade
- The agent generates both layers

**Source:** [Harbor: Why We Don't Use Effect-TS](https://runharbor.com/blog/2025-11-24-why-we-dont-use-effect-ts), [Effect Runtime docs](https://effect.website/docs/guides/runtime)

---

## 5. Agent SDK Multi-Turn Patterns for Code Generation

### 5.1 The Core Loop

From Anthropic's engineering blog, the fundamental agent pattern is:

```
gather context -> take action -> verify work -> repeat
```

For code generation specifically:
1. **Read spec** -- understand requirements
2. **Generate code** -- produce implementation
3. **Typecheck** -- run `tsc --noEmit` and capture errors
4. **Fix errors** -- feed errors back to model with context
5. **Run tests** -- execute `vitest run` and capture failures
6. **Fix failures** -- iterate until green
7. **Verify** -- final typecheck + test pass

### 5.2 LLMLOOP Framework (2025)

The LLMLOOP paper demonstrated that iterative feedback loops dramatically improve code quality:
- **pass@1: 80.85%** (vs ~71% without loops)
- **pass@10: 90.24%** (14% improvement)

The key: feed compiler errors AND test failures back to the LLM with structured context about what failed and why.

### 5.3 Progress Tracking for Multi-Context Sessions

From Anthropic's long-running agent research:

```json
{
  "features": [
    { "name": "rate-limiter", "status": "passing", "tests": 7 },
    { "name": "auth-middleware", "status": "in-progress", "tests": 3 }
  ]
}
```

**JSON over Markdown** for tracking -- "the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files."

### 5.4 Verification Patterns

| Claim | Required Evidence |
|-------|-------------------|
| "Fixed" | Test showing it passes now |
| "Implemented" | Clean typecheck + tests pass |
| "Refactored" | All existing tests still pass |

**Key insight:** "Strongly-worded instructions like 'It is unacceptable to remove or edit tests'" prevent agents from circumventing accountability.

**Source:** [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [Anthropic: Building Agents with Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk), [LLMLOOP paper](https://arxiv.org/pdf/2603.23613)

---

## 6. Prompt Engineering for TypeScript Generation

### 6.1 The 10 Guidelines (Empirical Study, Jan 2026)

From an empirical characterization of LLM code generation prompts (arxiv 2601.13118):

| Guideline | Application Rate | Impact |
|-----------|-----------------|--------|
| I/O format specification | 44% | Highest impact on correctness |
| Algorithmic details | 57% | Most frequently needed |
| Post-conditions | 23% | Output guarantees |
| Requirements/dependencies | 19% | Library usage |
| Concrete examples | 24% | Underutilized but high-value |
| Error handling spec | 12% | Exception types and conditions |
| Pre-conditions | 7% | Input constraints |
| Assertive language ("must" not "should") | 9% | Reduces ambiguity |
| Consistent variable naming | 3% | Terminology alignment |
| Explicit conditionals | 1% | Avoid "otherwise" |

### 6.2 What Works for TypeScript Specifically

- **Strong typing provides context**: Teams using TypeScript with AI report dramatically more accurate AI-generated code than JavaScript
- **TypeScript linting provides richer feedback** than JavaScript generation (from Claude Agent SDK docs)
- **Include tsconfig constraints** in the prompt context
- **Reference specific files** with examples rather than abstract rules

### 6.3 Prompt Structure for Effect Code Generation

Based on synthesis of all findings:

```
ROLE: You are an Effect TS expert generating production code.

CONSTRAINTS:
- TypeScript strict mode, exactOptionalPropertyTypes: true
- Effect v3.12+, @effect/schema, @effect/vitest
- All errors MUST use Data.TaggedError with _tag discriminant
- All domain types MUST use Schema.Struct with refinements
- Business logic MUST use Effect.gen generators
- Exports MUST be plain TS functions wrapping Effect via runSync/runSyncExit

SPEC: [include full spec text]

EXAMPLES: [include 1-2 similar implementations]

OUTPUT FORMAT:
1. schema.ts -- Schema definitions for all domain types
2. errors.ts -- TaggedError classes for all failure modes  
3. service.ts -- Effect service implementation
4. index.ts -- Plain TS boundary exports
5. index.test.ts -- Vitest tests using @effect/vitest

RULES:
- NEVER use try/catch inside Effect generators
- NEVER use Effect.runSync on async Effects
- ALWAYS apply Schema filters AFTER transformations
- ALWAYS provide fresh test layers per test (no shared state)
```

### 6.4 Compiler-to-LLM Workflow

From agenticthinking.ai:

> "Instead of starting with code, start with intent."

The recommended prompt engineering for fix iterations:
- State WHAT failed (specific error message)
- State WHY it failed (type mismatch, missing import, etc.)
- Reference the PATTERN to follow (link to existing working code)
- State what NOT to change

**Source:** [arxiv 2601.13118 - Guidelines for Prompting LLMs for Code Generation](https://arxiv.org/html/2601.13118v1), [Compiler-to-LLM Workflows](https://agenticthinking.ai/blog/compiler-to-llm-workflows/), [Builder.io: TypeScript vs JavaScript for AI](https://www.builder.io/blog/typescript-vs-javascript)

---

## 7. Effect Schema Validation Patterns

### 7.1 Core Schema Types

```typescript
import { Schema } from "effect"

// Primitive refinements
const PositiveInt = Schema.Int.pipe(Schema.positive())
const NonEmptyStr = Schema.NonEmptyString
const Email = Schema.String.pipe(Schema.pattern(/^[^@]+@[^@]+\.[^@]+$/))

// Struct schemas
const RateLimitConfig = Schema.Struct({
  maxTokens: PositiveInt,
  refillRate: PositiveInt,
  refillIntervalMs: PositiveInt,
})

// Extract types
type RateLimitConfig = Schema.Schema.Type<typeof RateLimitConfig>

// Branded types (nominal typing, zero runtime cost)
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Schema.Type<typeof UserId>
```

### 7.2 Schema.Class for Entities

```typescript
class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.NonEmptyString,
  email: Email,
}) {
  get displayName() {
    return `${this.name} <${this.email}>`
  }
}
```

Benefits:
- Structural equality via `Equal`
- `instanceof` checks work
- Runtime validation on construction
- Methods and getters

### 7.3 Schema.TaggedError for Domain Errors

```typescript
class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()(
  "RateLimitExceeded",
  {
    userId: Schema.String,
    retryAfterMs: Schema.Int.pipe(Schema.positive()),
  }
) {}
```

### 7.4 Decode/Encode Round-Trip

The golden rule: `encode(decode(x)) === x`

```typescript
const decode = Schema.decodeUnknownSync(RateLimitConfig)
const encode = Schema.encodeSync(RateLimitConfig)

const config = decode({ maxTokens: 10, refillRate: 1, refillIntervalMs: 1000 })
const raw = encode(config)
// raw deep-equals the original input
```

### 7.5 Schema-First Development Pattern

1. Define all domain types as Schemas
2. Derive TypeScript types from Schemas
3. Derive fast-check arbitraries from Schemas
4. Derive JSON schemas from Schemas (for docs/OpenAPI)
5. Use Schema.decodeUnknown at input boundaries
6. Use Schema.encode at output boundaries

**Source:** [Effect Schema Introduction](https://effect.website/docs/schema/introduction/), [Effect Schema Basic Usage](https://effect.website/docs/schema/basic-usage/), [Effect Schema Transformations](https://effect.website/docs/schema/transformations/)

---

## 8. Verification Status

| Finding | Verified for Effect v3.12+? | Notes |
|---------|----------------------------|-------|
| Schema.Struct, Schema.Class | Yes | Core API, stable |
| Data.TaggedError | Yes | Recommended since v3 |
| Arbitrary.make(schema) | Yes | In `effect` package |
| @effect/vitest it.effect | Yes | Active development |
| Effect.gen generators | Yes | Primary composition pattern |
| ManagedRuntime | Yes | For framework integration |
| Effect.fn with tracing | Yes | Added in v3.x |
| Schema.TaggedError | Yes | Unified with Data.TaggedError |
| FastCheck export from effect | Yes | Re-exported from fast-check |
| Layer.sync for test layers | Yes | Standard testing pattern |

---

## 9. Recommended Pipeline: The "Effect-God" Agent

### Step 0: System Prompt Setup

```
You are effect-god, an expert in Effect TS v3.12+ code generation.
You follow Schema-first, TDD-driven development with property-based testing.

STACK: Effect v3.12+, TypeScript 5.4+ strict, Vitest, fast-check via Effect
PATTERNS: Schema -> TaggedError -> Service -> Boundary -> Tests
```

### Step 1: Parse Spec into Schema (Schema-First)

Given a task specification:
1. Identify all domain types -> `Schema.Struct` with refinements
2. Identify all error cases -> `Data.TaggedError` classes
3. Identify all config inputs -> `Schema.Struct` with validation
4. Generate `schema.ts` and `errors.ts`

### Step 2: Generate Tests First (TDD)

Using the schemas from Step 1:
1. Write example-based tests with `it.effect()` or plain `it()` for boundary tests
2. Write property-based tests using `Arbitrary.make(schema)`
3. Cover: happy path, edge cases, error cases, invariants
4. Use `Effect.flip` for error assertion tests
5. Generate `*.test.ts`

### Step 3: Generate Implementation (Effect Internals)

1. Implement business logic using `Effect.gen` generators
2. Use services for stateful components
3. Use `Effect.try`/`Effect.tryPromise` for external interop
4. Never use try/catch inside generators
5. Generate `service.ts`

### Step 4: Generate Boundary Layer (Plain TS Exports)

1. Wrap each Effect function with `runSync`/`runSyncExit`
2. Map TaggedErrors to plain Error subclasses at boundary
3. Preserve error class identity for `instanceof` checks
4. Export clean, plain TypeScript API
5. Generate `index.ts`

### Step 5: Typecheck Feedback Loop

```
while (errors exist):
  1. Run: tsc --noEmit
  2. Parse errors (file, line, message)
  3. Feed back to model: "Fix these type errors: [structured error list]"
  4. Model generates corrected code
```

### Step 6: Test Feedback Loop

```
while (failures exist):
  1. Run: vitest run --reporter=verbose
  2. Parse failures (test name, expected vs actual, stack)
  3. Feed back to model: "These tests fail: [structured failure list]"
  4. Model generates corrected code
  5. Re-run typecheck (Step 5) before re-running tests
```

### Step 7: Property-Based Verification

After example tests pass:
1. Run property tests with higher iteration count (1000+)
2. If shrunk counterexample found, feed back with:
   - The counterexample values
   - The property that was violated
   - The shrunk minimal failing input
3. Model fixes implementation
4. Re-run full suite

### Step 8: Bug Detection Validation (Optional)

For benchmark scenarios:
1. Inject known bug variants
2. Run test suite against each variant
3. Verify tests catch the bug (exit code != 0)
4. If bug passes undetected, generate additional targeted tests

### Summary: The Full Pipeline

```
Spec -> Schema -> Errors -> Tests (TDD) -> Implementation -> Boundary ->
  Typecheck Loop -> Test Loop -> PBT Loop -> Bug Detection Check
```

Each step feeds forward. Each loop iterates with structured feedback until convergence. The Schema definitions serve triple duty: runtime validation, type derivation, and test data generation.

---

## Sources

### Effect TS Documentation & Patterns
- [Effect Schema Introduction](https://effect.website/docs/schema/introduction/)
- [Effect Schema Arbitrary Generation](https://effect.website/docs/schema/arbitrary/)
- [Effect Runtime Guide](https://effect.website/docs/guides/runtime)
- [Effect Expected Errors](https://effect.website/docs/error-management/expected-errors/)
- [Effect Yieldable Errors](https://effect.website/docs/error-management/yieldable-errors/)
- [Effect Services](https://effect.website/docs/requirements-management/services/)
- [Effect Layers](https://effect.website/docs/requirements-management/layers/)
- [EffectPatterns Repository (300+ patterns)](https://github.com/PaulJPhilp/EffectPatterns)
- [Effect-TS Patterns (DeepWiki)](https://deepwiki.com/tim-smart/effect-mcp/5.2-effect-ts-patterns-and-best-practices)
- [Effect Testing (DeepWiki)](https://deepwiki.com/Effect-TS/effect/7.2-testing-and-property-based-testing)
- [Effect Solutions - Testing](https://www.effect.solutions/testing)
- [@effect/vitest on npm](https://www.npmjs.com/package/@effect/vitest)
- [Effect Best Practices (dtech.vision)](https://dtech.vision/blog/how-to-effect-ts-best-practices/)
- [Effect Myths](https://effect.website/docs/additional-resources/myths/)

### Critiques & Boundary Challenges
- [Harbor: Why We Don't Use Effect-TS (2025)](https://runharbor.com/blog/2025-11-24-why-we-dont-use-effect-ts)
- [Tweag: Exploring Effect in TypeScript](https://www.tweag.io/blog/2024-11-07-typescript-effect/)

### Agent & Code Generation Research
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Building Agents with Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [LLMLOOP: Improving LLM-Generated Code (2025)](https://arxiv.org/pdf/2603.23613)
- [Compiler-to-LLM Workflows](https://agenticthinking.ai/blog/compiler-to-llm-workflows/)
- [ProCoder: Iterative Refinement with Compiler Feedback](https://arxiv.org/html/2403.16792v2)
- [Helping LLMs with Feedback from Testing and Static Analysis](https://arxiv.org/html/2412.14841v1)

### Prompt Engineering
- [Guidelines to Prompt LLMs for Code Generation (arxiv 2601.13118)](https://arxiv.org/html/2601.13118v1)
- [Builder.io: TypeScript vs JavaScript for AI](https://www.builder.io/blog/typescript-vs-javascript)
- [Angular AI Development Guidelines](https://angular.dev/ai/develop-with-ai)
- [LLM Prompts for TypeScript (GitHub)](https://github.com/jamesponddotco/llm-prompts/blob/trunk/data/coding-in-typescript.md)

### Property-Based Testing
- [fast-check Documentation](https://fast-check.dev/)
- [fast-check GitHub](https://github.com/dubzzz/fast-check)
- [fast-check Examples](https://github.com/dubzzz/fast-check-examples)

### TDD
- [TDD with TypeScript (Promptz.dev spec)](https://www.promptz.dev/rules/typescript/typescript-tdd-behavioural-test-specifications/)
- [TDD with TypeScript and Vitest (Medium)](https://medium.com/@rmbagt/test-driven-development-tdd-with-typescript-and-reactjs-using-vitest-7187d9126a0e)
