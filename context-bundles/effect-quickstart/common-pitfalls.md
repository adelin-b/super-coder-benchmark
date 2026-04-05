# Effect TS — Common Pitfalls

## 1. FiberFailure Trap

`Effect.runPromise` wraps failures in `FiberFailure`. A `try/catch` sees FiberFailure, **not** your domain error.

```typescript
// WRONG — in tests
try {
  await Effect.runPromise(Effect.fail(new MyError()))
} catch (e) {
  // e is FiberFailure, e instanceof MyError === false
}

// RIGHT — use runPromiseExit + Exit.match
const exit = await Effect.runPromiseExit(program)
Exit.match(exit, {
  onFailure: (cause) => { /* cause contains your typed error */ },
  onSuccess: (value) => { /* success path */ },
})
```

## 2. throw Inside Effect.gen

**Never** use naked `throw` inside generators. It becomes an untyped defect.

```typescript
// WRONG
Effect.gen(function* () {
  if (!valid) throw new Error("bad") // becomes Die, not Fail
})

// RIGHT
Effect.gen(function* () {
  if (!valid) yield* Effect.fail(new ValidationError({ reason: "bad" }))
})
```

## 3. Effect.die for Domain Errors

`Effect.die` is for **bugs/defects** — it bypasses the typed error channel.

```typescript
// WRONG — domain error invisible to type system
Effect.die(new InsufficientFunds())

// RIGHT — tracked in E channel
Effect.fail(new InsufficientFunds())
```

## 4. XState v5 + Effect Interop

When invoking Effect from XState actors, use `fromPromise`:

```typescript
import { fromPromise } from "xstate"

const fetchActor = fromPromise(async ({ input }: { input: { id: string } }) => {
  return await Effect.runPromise(myEffect(input.id))
})

// In machine setup:
setup({
  actors: { fetchActor },
}).createMachine({
  // ... invoke: { src: 'fetchActor', input: { id: '42' } }
})
```

## 5. Schema Validation (brief)

Use `@effect/schema` for runtime validation:

```typescript
import { Schema } from "@effect/schema"

const User = Schema.Struct({
  name: Schema.String,
  age: Schema.Number.pipe(Schema.positive()),
})

const decode = Schema.decodeSync(User)
const user = decode({ name: "Ada", age: 30 }) // throws on invalid
```

## Quick Checklist

- Domain errors: `Effect.fail()` + `Data.TaggedError`
- Tests: `Effect.runPromiseExit` + `Exit.match` (never try/catch on runPromise)
- Generators: `yield* Effect.fail(...)` not `throw`
- XState interop: `fromPromise(({ input }) => Effect.runPromise(...))`
