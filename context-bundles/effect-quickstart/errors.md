# Effect TS — Error Handling

## Three Ways to Signal Errors

| Method | Use When | Type Tracking |
|--------|----------|---------------|
| `Effect.fail(new MyError())` | Domain/expected errors | Yes — appears in `E` channel |
| `Effect.die(new Error())` | Bugs/defects only | No — becomes untyped defect |
| `throw` inside Effect | **NEVER do this** | Breaks the Effect contract |

## Creating Typed Errors with Data.TaggedError

```typescript
import { Data } from "effect"

class NotFound extends Data.TaggedError("NotFound")<{ id: string }> {}
class RateExceeded extends Data.TaggedError("RateExceeded")<{ limit: number }> {}

// Automatically has _tag: "NotFound", structurally equal
const err = new NotFound({ id: "123" })
```

## Matching Errors

**`Effect.catchTag`** — handle one tagged error:
```typescript
program.pipe(
  Effect.catchTag("NotFound", (e) =>
    Effect.succeed(`Missing: ${e.id}`)
  )
)
```

**`Effect.catchAll`** — handle all errors:
```typescript
program.pipe(
  Effect.catchAll((error) => Effect.succeed("fallback"))
)
```

**`Effect.either`** — convert to Either for pattern matching:
```typescript
program.pipe(
  Effect.either,
  Effect.map((result) =>
    Either.match(result, {
      onLeft: (error) => `fail: ${error._tag}`,
      onRight: (value) => `ok: ${value}`,
    })
  )
)
```

## CRITICAL: FiberFailure Wrapping

`Effect.runPromise` rejects with **FiberFailure**, not your original error:

```typescript
// BAD — catches FiberFailure, not NotFound
try { await Effect.runPromise(program) }
catch (e) { /* e is FiberFailure, NOT NotFound */ }

// GOOD — use runPromiseExit in tests
import { Exit } from "effect"
const exit = await Effect.runPromiseExit(program)
Exit.match(exit, {
  onFailure: (cause) => { /* inspect cause.error */ },
  onSuccess: (value) => { /* use value */ },
})
```

## In Tests: Always Use runPromiseExit

```typescript
it("fails with NotFound", async () => {
  const exit = await Effect.runPromiseExit(program)
  expect(exit._tag).toBe("Failure")
})
```
