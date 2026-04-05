# Effect TS — Generators & Core Patterns

## The Generator Pattern (primary coding style)

```typescript
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const user = yield* fetchUser(userId)      // unwrap Effect
  const order = yield* createOrder(user.id)   // chain Effects
  return { user, order }                       // wrap in succeed
})
```

`yield*` unwraps an `Effect<A, E, R>` to get `A`. If the effect fails, the generator short-circuits.

## Creating Effects

| Constructor | Purpose | Error Type |
|-------------|---------|------------|
| `Effect.succeed(42)` | Pure value | `never` |
| `Effect.fail(new MyErr())` | Domain error | `MyErr` |
| `Effect.sync(() => expr)` | Sync side effect | `never` |
| `Effect.try(() => JSON.parse(s))` | Sync that may throw | `UnknownException` |
| `Effect.promise(() => fetch(url))` | Async (cannot fail) | `never` |
| `Effect.tryPromise(() => fetch(url))` | Async that may reject | `UnknownException` |

**Custom error on tryPromise:**
```typescript
Effect.tryPromise({
  try: () => fetch(url),
  catch: (e) => new NetworkError({ cause: String(e) }),
})
```

## Pipe Composition

```typescript
import { pipe } from "effect"

const result = pipe(
  Effect.succeed(5),
  Effect.map((n) => n * 2),
  Effect.flatMap((n) => n > 0 ? Effect.succeed(n) : Effect.fail(new Negative())),
  Effect.catchTag("Negative", () => Effect.succeed(0))
)
```

## Complete Example

```typescript
import { Effect, Data } from "effect"

class InvalidInput extends Data.TaggedError("InvalidInput")<{ reason: string }> {}

const validate = (n: number) =>
  n > 0 ? Effect.succeed(n) : Effect.fail(new InvalidInput({ reason: "must be positive" }))

const compute = (n: number) => Effect.succeed(n * 2 + 1)

const program = Effect.gen(function* () {
  const valid = yield* validate(42)
  const result = yield* compute(valid)
  return result
})

// Run: const value = await Effect.runPromise(program)
```
