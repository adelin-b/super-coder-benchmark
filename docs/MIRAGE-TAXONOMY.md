# Semantic-Mirage Bug Taxonomy

**Mirage bug**: code that uses the *correct vocabulary* of a library (Effect-TS, XState, Quint) but the *wrong semantics*. Looks right, isn't. Type-checks (or parses) but does the wrong thing at runtime, or compiles to a no-op, or silently strips an invariant.

**Why this matters for LLMs**: pattern-matched generation reuses surface tokens (`Effect.gen`, `yield*`, `invoke`, `nondet`, `temporal`) without internalizing the host language's *modes* / *channels* / *purity rules*. The result clears review-by-eye and survives many unit tests, but fails on the specific behaviors the library exists to guarantee.

Each entry: **name**, **plausible snippet** (looks fine), **why it's wrong**, **behavioral test** (the thing that catches it).

---

## Effect-TS mirages (E1–E6)

### E1. `await` inside `Effect.gen`
```ts
const program = Effect.gen(function* () {
  const data = await fetchUser(42);   // bug: raw await
  return data.name;
});
```
**Why wrong**: `Effect.gen` is a generator, not async. `await` evaluates the Promise *synchronously inside the generator* (i.e. returns the Promise itself, not the user). `program` becomes `Effect<Promise<...>>`, never the resolved value. Should be `yield* Effect.promise(() => fetchUser(42))` or `yield* Effect.tryPromise(...)`.
**Test**: call `.pipe(Effect.runPromise)`, expect `string`; assert `typeof result === 'string'`. With the bug you get a Promise object.

### E2. `Effect.tryPromise` with non-failing `catch`
```ts
Effect.tryPromise({
  try: () => api.fetch(),
  catch: (e) => new Error(String(e)),    // bug: throws away typed error
});
```
**Why wrong**: `catch` must produce the *typed* error you want in the `E` channel. Returning plain `Error` collapses to `Error` and loses the `_tag`-discriminated union you need for `catchTag`. Downstream `catchTag('NetworkError', ...)` silently fails to match.
**Test**: trigger failure; assert `Effect.catchTag('NetworkError', handler)` runs `handler`. With the bug, `handler` never fires.

### E3. `Effect.succeed(promise)`
```ts
const program = Effect.succeed(fetchUser(42));   // bug: wraps Promise, not awaits
```
**Why wrong**: `Effect.succeed` takes a *value*. A Promise *is* a value. `program` is `Effect<Promise<User>>`. Result of `runPromise` is the Promise itself, unresolved.
**Test**: `expect(await Effect.runPromise(program)).toMatchObject({ name: 'Alice' })`. With the bug, `result` is a Promise.

### E4. Layer not provided (R-channel leak)
```ts
const useDb = Effect.gen(function* () {
  const db = yield* Database;
  return yield* db.query('SELECT 1');
});
Effect.runPromise(useDb);   // bug: missing Layer.provide
```
**Why wrong**: `useDb : Effect<X, Y, Database>`. `runPromise` requires `R = never`. TypeScript may catch this if strict; if generics are widened (`Effect<unknown, unknown, never>` via `as any` or lax helper), it sneaks through and crashes at runtime: `Service not found: Database`.
**Test**: run; assert no `Service not found` thrown. Caught by behavioral execution, missed by hasty type review.

### E5. `Effect.gen` returns generator object, not Effect
```ts
function workflow() {
  return function* () {           // bug: returns plain generator-factory, not Effect.gen
    yield* step1;
    yield* step2;
  };
}
```
**Why wrong**: missing the `Effect.gen(...)` wrapper. `workflow()` is `() => Generator`, not `Effect`. Calling `Effect.runPromise(workflow())` blows up with `Cannot read properties of undefined`.
**Test**: `Effect.isEffect(workflow())` must be true; with the bug, false.

### E6. `Effect.map` used for effectful function
```ts
const program = Effect.map(getUser(id), (user) => fetchPosts(user.id));
//                                              ^^^^^^^^^^^^^^^^^^^^ returns Effect
```
**Why wrong**: `Effect.map` is for pure transforms. If the function returns another `Effect`, you end up with `Effect<Effect<Posts>>`. Should be `Effect.flatMap` (or `yield*` in gen).
**Test**: assert `runPromise` resolves to `Posts[]`. With the bug, it resolves to `Effect<Posts[]>` (an object with `_id`/`_tag`).

---

## XState mirages (X1–X6)

### X1. Guard with side effects
```ts
guard: ({ context, event }) => {
  context.attempts++;        // bug: mutation in guard
  return context.attempts < 3;
}
```
**Why wrong**: guards must be **pure** predicates. XState may evaluate them zero, one, or many times per transition (especially with parallel states or eventless transitions). Mutating context here corrupts counters or off-by-ones; the same event may be checked multiple times.
**Test**: send the same event N times, then assert `context.attempts === N` (intended) — with the bug, you'll see N×k where k is the number of guard re-evaluations.

### X2. `invoke.src` returns a non-thenable
```ts
invoke: {
  src: fromPromise(({ input }) => ({ user: input.userId }))  // bug: returns object, not Promise
}
```
**Why wrong**: `fromPromise` expects a function returning a `Promise`. Returning a plain object makes `onDone` fire immediately with `event.output = { user, then?: undefined }` — or it never fires consistently. Subtle: ESLint/types may not catch because `({user})` is "assignable" to the awaited type via inference.
**Test**: hit the invoking state, wait one tick, assert state has transitioned to `success`. With bug, behavior depends on engine version — fails in newer XState 5.

### X3. `always` (eventless) without guard → infinite loop
```ts
states: {
  checking: {
    always: { target: 'checking' }   // bug: no guard
  }
}
```
**Why wrong**: `always` re-evaluates whenever the state is entered. Targeting the same state with no condition spins forever.
**Test**: actor crash / timeout on enter `checking`. Stack overflow in dev mode.

### X4. `cond` (v4) used in v5
```ts
on: {
  SUBMIT: { target: 'sending', cond: 'isValid' }   // bug: v4 key in v5 schema
}
```
**Why wrong**: XState v5 renamed `cond` → `guard`. v5 schema silently ignores unknown keys — transition fires *unconditionally*.
**Test**: send `SUBMIT` with invalid context, assert we stayed in current state. With bug, we transition anyway.

### X5. `assign` outside `actions` array
```ts
on: {
  INC: { target: 'next', assign: { count: ({context}) => context.count + 1 } }
  //                     ^^^^^^ bug: `assign` is not a transition key
}
```
**Why wrong**: `assign` is an action producer; it must live inside `actions: [...]`. Putting it as a transition key means context never updates.
**Test**: send INC; assert `actor.getSnapshot().context.count === 1`. With bug, stays at 0.

### X6. `onDone` referencing wrong actor id
```ts
invoke: { id: 'fetcher', src: fromPromise(getData) },
on: {
  'xstate.done.actor.dataFetcher': { target: 'success' }  // bug: id mismatch (fetcher vs dataFetcher)
}
```
**Why wrong**: invoke id is `fetcher`, but the listener is for `dataFetcher`. Promise resolves, `onDone` never fires, state hangs.
**Test**: assert transition to `success` within timeout. With bug, timeout.

---

## Quint mirages (Q1–Q6)

### Q1. `val` referencing a state variable
```quint
var n: int
val isPositive = n > 0    // bug: val is stateless mode; n is State
```
**Why wrong**: Quint's mode system rejects this — `val` is Stateless, `n > 0` is State mode (subsumption goes the other way). A confused author writes `val` when they meant `def` (which can be State). Quint typechecker catches it; an LLM patch that silences the error by removing `val` loses the contract.
**Test**: `quint typecheck` should succeed. If author downgrades to `def` *and* meant to allow only-pure access, downstream callers may now violate invariants.

### Q2. `action` without primed variable assignment
```quint
var counter: int
action inc = {
  counter + 1     // bug: not actually assigning. Should be: counter' = counter + 1
}
```
**Why wrong**: Quint actions express *transitions*: next-state variables are primed (`counter' = ...`). An expression without `'` is a stateless boolean condition that doesn't change state. `inc` becomes a no-op (or, worse, an always-true predicate). Simulator runs without ever incrementing.
**Test**: run `quint run --invariant=counter==0 --max-steps 10`. With the bug, the invariant `counter == 0` never breaks. Healthy `inc` *would* break it.

### Q3. Temporal operator in invariant slot
```quint
val safe = always(balance >= 0)   // bug: 'always' is temporal, 'val' must be Stateless/State
```
**Why wrong**: temporal formulas live in `temporal` definitions and are checked with `--temporal`. Putting `always(...)` in a `val` mixes modes; the typechecker rejects it. Author "fixes" by removing `always`, losing the meaning.
**Test**: invariant check must pass; the *temporal* check is what should expose violations. Conflating the two means you only check one initial-state slice.

### Q4. `nondet` outside an action
```quint
val pickedValue =                  // bug: nondet only legal in action mode
  nondet x = oneOf(0.to(10))
  x * 2
```
**Why wrong**: `nondet` is in Non-determinism mode; legal inside `action` only. Typechecker rejects.
**Test**: `quint typecheck` fails. LLM "fix" of converting to `def` loses non-determinism — model collapses to a single choice and no longer explores the state space.

### Q5. `init` doesn't bind every `var`
```quint
var x: int
var y: int
action init = all { x' = 0 }    // bug: y unconstrained
```
**Why wrong**: every `var` must be bound in `init` (or it's an unconstrained free variable, leading to Apalache rejection or TLC blowing up exploring all integers). Simulator may pick zero by default; model checker won't.
**Test**: `quint verify --invariant=Inv` should not crash. With bug, Apalache complains about unconstrained variable.

### Q6. `step` action drops a variable
```quint
var x: int
var y: int
action step = all { x' = x + 1 }    // bug: missing y' = y
```
**Why wrong**: in TLA-style semantics, an action that doesn't mention `y'` leaves `y'` *unconstrained* (non-determinism over its entire type). Almost always you want UNCHANGED y, i.e. `y' = y`. Forgetting this means the model checker sees random `y` jumps and flags spurious invariant violations — or, if `y`'s type is `int`, simulation never terminates.
**Test**: run simulator with invariant `y == 0`; with the bug it breaks immediately (y can become anything). Healthy spec preserves `y`.

---

## Cross-cutting meta-mirages (M1–M3)

### M1. Type-perfect, runtime-broken
Code that satisfies `tsc --strict` and library types *exactly*, but violates a runtime invariant the library doesn't encode (e.g., XState guard purity, Effect's "do not throw in `Effect.sync`").
**Why missed**: type review can't catch it; only behavioral tests can.

### M2. Library-version skew (v4 vs v5 keys, Effect 2.x vs 3.x signatures)
Pattern lifted from an old StackOverflow answer or training-set snippet. Compiles or runs in *some* version, deceives review.
**Why missed**: reviewer trusts the keyword.

### M3. The "looks like the docs" copy
LLM paraphrases the docs into the user's variable names. Structure looks pristine but one critical operator was swapped: `Effect.flatMap` ↔ `Effect.map`, `always` ↔ `eventually`, `nondet` ↔ `def`. Single-token corruption with high blast radius.
**Why missed**: pattern-matches "this is how the docs do it."

---

## Why this works as a benchmark axis

1. **Behavioral tests required**: type-checking and surface-pattern review cannot catch these. Tests exercise the actual semantics.
2. **Adversarial to LLMs**: pattern-matched generation gravitates toward correct-looking surface. The mirage is the *easy* code; the fix is the *thoughtful* code.
3. **Library-specific**: each entry has a clear root cause in the host language's design (mode system, monadic structure, statechart semantics). Hard to fix with generic prompting.
4. **Detection has a checklist**: the `spot-semantic-mirage` skill operationalizes M1–M3 and per-library red flags into a step-by-step process.

## Coverage check

- Effect-TS: 6 patterns covering generator misuse (E1, E5), error channel (E2), value/promise confusion (E3), R-channel (E4), map-vs-flatMap (E6).
- XState: 6 patterns covering guard purity (X1), invoke contract (X2, X6), eventless loops (X3), version skew (X4), assign placement (X5).
- Quint: 6 patterns covering mode system (Q1, Q3, Q4), action discipline (Q2, Q5, Q6).
- Total: **18 patterns** as required by G001 evidence criteria.

## References used while authoring

- Effect-TS docs: [Using Generators](https://effect.website/docs/getting-started/using-generators/), [Expected Errors](https://effect.website/docs/error-management/expected-errors/), [Effect Type](https://effect.website/docs/getting-started/the-effect-type/)
- XState (Stately) docs: [Invoke](https://stately.ai/docs/invoke), [Guards](https://stately.ai/docs/guards), [Transitions](https://stately.ai/docs/transitions)
- Quint docs: [Language Manual](https://quint-lang.org/docs/lang), [Checking Properties](https://quint-lang.org/docs/checking-properties), [CLI](https://github.com/informalsystems/quint/blob/main/docs/content/docs/quint.md)
- Real-world LLM failure-mode study: [arXiv 2510.26130](https://arxiv.org/html/2510.26130v1) — AttributeError/TypeError triad analog of these mirages in Python class generation.
