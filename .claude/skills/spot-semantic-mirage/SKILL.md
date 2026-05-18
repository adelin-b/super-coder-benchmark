---
name: spot-semantic-mirage
description: Detect "looks-right-but-wrong" code in Effect-TS, XState, and Quint. Use when reviewing AI-generated code that uses these libraries' vocabulary correctly but may have wrong semantics. Runs a step-by-step library-aware checklist that finds mode mismatches, generator-yield discipline breaks, guard purity violations, and version-skew patterns.
---

# Spot Semantic Mirage

LLM-generated code in **Effect-TS / XState / Quint** often uses the right *vocabulary* but the wrong *semantics*. Types pass. Surface review passes. Tests catch it — but only the right tests. This skill is the checklist that catches it at review time before tests are written.

Companion reference: `docs/MIRAGE-TAXONOMY.md` (18 patterns, 6 per library). When you cite a pattern in your output, use its ID (E1–E6, X1–X6, Q1–Q6, M1–M3).

## When to use

- Reviewing a diff that touches `import { ... } from 'effect'`, `import { ... } from 'xstate'`, or any `*.qnt` file
- A test fails on behavior but the code "looks correct"
- The user generated code from a docs snippet but it's misbehaving
- Auditing a passing test suite for false-positive coverage

## When NOT to use

- Pure refactor without behavior change
- Code that doesn't import any of the three libraries (use generic review)
- Style/formatting only

## The procedure (run in order — do not skip)

### Step 0 — Identify scope

Grep the diff/file for library imports. For each found library, follow that library's section. If multiple libraries, do all sections.

```bash
grep -nE "from ['\"]effect['\"]|from ['\"]xstate['\"]|\.qnt$" <files>
```

### Step 1 — Effect-TS checklist (if any `effect` import)

Read each suspect block twice. First pass for syntax, second for **mode**:

| # | Red flag | What it means | Pattern ID |
|---|----------|--------------|-----------|
| 1 | `await` token *inside* `Effect.gen` body | `Effect.gen` is a generator, not async. Use `yield* Effect.promise(...)` | E1 |
| 2 | `Effect.tryPromise({ try, catch })` where `catch` returns `new Error(...)` | Loses typed `_tag`, breaks downstream `catchTag` | E2 |
| 3 | `Effect.succeed(somePromise())` or `Effect.succeed(asyncFn())` | Wraps Promise as value, never resolves | E3 |
| 4 | Service `yield* SomeTag` consumed without a matching `Layer.provide` before `runPromise`/`runSync` | R-channel leak; runtime error `Service not found` | E4 |
| 5 | Function whose body is `function* () { yield* ... }` returned bare (no `Effect.gen` wrapper) | Result is a generator factory, not an Effect | E5 |
| 6 | `Effect.map(x, fn)` where `fn` returns an `Effect` | Yields `Effect<Effect<X>>`. Use `Effect.flatMap` or `yield*` | E6 |

**Step-by-step action**: for each red flag found, write a finding of the form:

```
[E<n>] <file>:<line> — <one-line summary>
WHY: <one-line semantics explanation>
TEST: <test that catches behavior, not syntax>
FIX: <minimal patch>
```

### Step 2 — XState checklist (if any `xstate` import or `.machine.ts`)

| # | Red flag | What it means | Pattern ID |
|---|----------|--------------|-----------|
| 1 | A `guard` function that contains `=`, `.push(`, `++`, or any mutation of `context` | Guard not pure; XState may eval multiple times per transition | X1 |
| 2 | `invoke.src` body returning a plain object or non-thenable instead of a Promise (or `fromPromise(...)` wrapper missing) | `onDone`/`onError` never fire reliably | X2 |
| 3 | `always: { target: 'X' }` with **no guard** — and `X` can transition back | Infinite eventless loop | X3 |
| 4 | The key `cond:` anywhere in a v5 machine | v4 leftover. v5 uses `guard`. v5 silently ignores `cond`; transition fires unconditionally | X4 |
| 5 | The key `assign:` directly on a transition object (not inside `actions: [...]`) | Silently ignored; context never updates | X5 |
| 6 | `on: { 'xstate.done.actor.<id>': ... }` where `<id>` does not match any `invoke.id` in the same state | Listener dead. State hangs after promise resolution | X6 |

**Action**: same finding format as Step 1.

### Step 3 — Quint checklist (if any `.qnt` file)

| # | Red flag | What it means | Pattern ID |
|---|----------|--------------|-----------|
| 1 | `val foo = <expression that references a state variable>` | Mode violation: `val` is Stateless. Did you mean `def`? | Q1 |
| 2 | `action` body with no primed (`'`) variable on LHS | Action has no state effect. Likely missing `var' = ...` | Q2 |
| 3 | `always(...)` or `eventually(...)` inside a `val` or `def` instead of `temporal` | Temporal in invariant slot, will not work as expected | Q3 |
| 4 | `nondet x = oneOf(S); ...` outside an `action` | Non-determinism only legal in action mode | Q4 |
| 5 | `init` action that doesn't bind all declared `var`s (count `var` declarations vs primed assignments in `init`) | Apalache rejects; TLC explores entire domain | Q5 |
| 6 | `step` (or named action used as step) that mentions some `var`s but not all — and the missing ones have no `var' = var` (UNCHANGED-style) | Missing variable jumps arbitrarily in TLA semantics | Q6 |

**Action**: same finding format. For Q2/Q5/Q6, suggest running `quint typecheck && quint run --invariant=<X>` to confirm.

### Step 4 — Cross-cutting (always run)

| # | Red flag | What it means | Pattern ID |
|---|----------|--------------|-----------|
| 1 | Code type-checks but no test asserts on **library-runtime** invariants (e.g., XState guard purity, Effect Layer satisfaction) | M1 — type-perfect, runtime-broken |
| 2 | Snippet uses a key that looks like another version's API (`cond` vs `guard`, `@effect/io` vs `effect`, `Effect.gen` vs `pipe`) | M2 — version skew |
| 3 | Function logic mirrors the docs example structurally with one operator swap (`map`/`flatMap`, `always`/`eventually`, `nondet`/`def`) | M3 — single-token corruption |

### Step 5 — Output

Produce a single ordered list of findings, sorted: blockers (E*, X*, Q* runtime breaks) → smells (M*) → style notes (none — drop them).

```
FINDINGS (3 blockers, 1 smell):
  1. [E1] auth.ts:42 — `await fetch(...)` inside Effect.gen
     WHY: returns Promise unevaluated as Effect value
     TEST: expect(typeof result === 'string')
     FIX: yield* Effect.tryPromise({ try: () => fetch(...), catch: err => new HttpError({ cause: err }) })

  2. [X4] machine.ts:88 — `cond: 'isValid'` key (v5 expects `guard`)
     WHY: v5 ignores unknown keys; transition fires unconditionally
     TEST: send event with invalid context; assert NOT in target state
     FIX: rename `cond` → `guard`

  ...
```

If zero findings: report `"NO MIRAGE FOUND. <N> patterns checked across <libs>."` Do not pad with praise.

## Examples

### Example 1 — Effect-TS mirage caught

Code under review:
```ts
const program = Effect.gen(function* () {
  const user = await fetchUser(id);
  return user.name;
});
const name = await Effect.runPromise(program);
```

Run Step 1, row #1 matches. Output:
```
FINDINGS (1 blocker):
  1. [E1] user.ts:3 — `await fetchUser(id)` inside Effect.gen
     WHY: Effect.gen body is a generator; await on Promise returns the Promise itself, not the user
     TEST: assert typeof (await Effect.runPromise(program)) === 'string'
     FIX: const user = yield* Effect.tryPromise({
            try: () => fetchUser(id),
            catch: (e) => new FetchError({ cause: e })
          })
```

### Example 2 — XState v5 cond mirage

Code under review:
```ts
const machine = setup({...}).createMachine({
  on: {
    SUBMIT: { target: 'sending', cond: 'isValid' }
  }
})
```

Run Step 2 row #4. Output:
```
FINDINGS (1 blocker):
  1. [X4] form.ts:14 — `cond:` key on transition (v4 leftover)
     WHY: XState v5 silently ignores unknown keys; SUBMIT transitions regardless of validity
     TEST: actor.send({ type: 'SUBMIT' }) with invalid context; assert state !== 'sending'
     FIX: rename `cond: 'isValid'` → `guard: 'isValid'`
```

### Example 3 — Quint Q2

Code under review:
```quint
var counter: int
action inc = {
  counter + 1
}
action init = all { counter' = 0 }
```

Run Step 3 row #2. Output:
```
FINDINGS (1 blocker):
  1. [Q2] counter.qnt:3 — `action inc` has no primed assignment
     WHY: action without `'` is a Boolean predicate, not a transition. `inc` does nothing.
     TEST: `quint run --invariant 'counter == 0' --max-steps 10` should EVENTUALLY break for healthy spec; with bug, never breaks.
     FIX: action inc = all { counter' = counter + 1 }
```

## Guidelines

- **Reference the taxonomy by ID** (`E1`, `X4`, `Q2`, `M3`) so the user can find the full pattern in `docs/MIRAGE-TAXONOMY.md`.
- **Never modify the file from inside this skill.** Output findings only; the human or another agent applies fixes.
- **Behavioral test, not syntactic test.** A test like `expect(code).toContain('yield*')` is a smell, not a fix. The test must exercise the runtime contract.
- **Falsifiable**: if you can't write a test that fails on the buggy code and passes on the fix, you have not found a mirage. Downgrade to a smell.
- **Don't pad.** No findings → say so in one line.

## Output budget

For a single file review, target ≤ 12 findings. If more, batch by pattern and report counts: `[E1] ×3 occurrences, see auth.ts:42, login.ts:7, signup.ts:9.`
