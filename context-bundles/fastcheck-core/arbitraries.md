# fast-check — Property-Based Testing

## Basic Property Test

```typescript
import fc from "fast-check"

fc.assert(
  fc.property(fc.integer(), fc.string(), (n, s) => {
    // must return true or not throw
    return typeof n === "number" && typeof s === "string"
  })
)
```

## Configuration

```typescript
fc.assert(property, {
  numRuns: 1000,    // default 100
  seed: 42,         // reproducible
  verbose: true,    // show all values on failure
})
```

## Preconditions — Filter Inputs

```typescript
fc.assert(
  fc.property(fc.integer(), (n) => {
    fc.pre(n > 0)  // skip if n <= 0 (does not count as a run)
    return myFn(n) > 0
  })
)
```

## Built-in Arbitraries

| Arbitrary | Generates |
|-----------|-----------|
| `fc.integer()` | any integer |
| `fc.integer({ min: 0, max: 100 })` | bounded integer |
| `fc.nat()` | non-negative integer |
| `fc.double()` | floating point |
| `fc.string()` | unicode string |
| `fc.boolean()` | true / false |
| `fc.constant(v)` | fixed value |

## Composite Arbitraries

```typescript
// Record with typed shape
fc.record({
  name: fc.string(),
  age: fc.integer({ min: 0, max: 120 }),
  active: fc.boolean(),
})

// Array of integers (0-10 elements)
fc.array(fc.integer(), { minLength: 0, maxLength: 10 })

// Tuple (fixed-length, typed)
fc.tuple(fc.string(), fc.integer())

// Union — pick from alternatives
fc.oneof(fc.constant("A"), fc.constant("B"), fc.constant("C"))
```

## Async Properties

```typescript
fc.assert(
  fc.asyncProperty(fc.integer(), async (n) => {
    const result = await asyncFn(n)
    return result >= 0
  })
)
```

## Shrinking

Automatic. When a test fails, fast-check finds the **smallest** counterexample. No configuration needed — only override if you have a custom arbitrary.

## Context for Debugging

```typescript
fc.assert(
  fc.property(fc.integer(), fc.context(), (n, ctx) => {
    ctx.log(`Testing with n=${n}`)  // shown only on failure
    return myFn(n) > 0
  })
)
```
