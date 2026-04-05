# XState v5 Primer

## Machine Creation (v5 API)

```typescript
import { setup, assign, createActor, fromPromise } from "xstate"

const machine = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: "increment" } | { type: "reset" },
  },
  actors: {
    fetchData: fromPromise(async ({ input }: { input: { id: string } }) => {
      const res = await fetch(`/api/${input.id}`)
      return res.json()
    }),
  },
}).createMachine({
  id: "counter",
  context: { count: 0 },
  initial: "idle",
  states: {
    idle: {
      on: {
        increment: {
          guard: ({ context }) => context.count < 10,
          actions: assign({ count: ({ context }) => context.count + 1 }),
          target: "idle",
        },
      },
    },
    loading: {
      invoke: {
        src: "fetchData",
        input: ({ context }) => ({ id: String(context.count) }),
        onDone: {
          target: "idle",
          actions: assign({ count: ({ event }) => event.output.value }),
        },
        onError: "error",
      },
    },
    error: {},
  },
})
```

## Running a Machine

```typescript
const actor = createActor(machine)
actor.subscribe((snapshot) => console.log(snapshot.value, snapshot.context))
actor.start()
actor.send({ type: "increment" })
```

## Assign (v5 syntax)

```typescript
// Each key is a function receiving { context, event }
assign({
  count: ({ context, event }) => context.count + 1,
})
```

## Guards (inline or named)

```typescript
// Inline
on: { submit: { guard: ({ context }) => context.isValid, target: "done" } }

// Named (in setup)
setup({ guards: { isValid: ({ context }) => context.isValid } })
```

## fromPromise for Async

```typescript
const fetcher = fromPromise(async ({ input }: { input: { url: string } }) => {
  const res = await fetch(input.url)
  return res.json()
})
```

## v4 to v5 Breaking Changes

| v4 | v5 |
|----|-----|
| `Machine({ ... })` | `setup({}).createMachine({})` |
| `assign({ key: (ctx, evt) => ... })` | `assign({ key: ({ context, event }) => ... })` |
| `services: { ... }` | `actors: { ... }` in setup |
| `context: (ctx, evt) => ...` in assign | `context: ({ context, event }) => ...` |
| String action references resolved at interpret | Named in `setup({ actions: {} })` |
