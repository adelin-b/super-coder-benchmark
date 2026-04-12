# WEB-TS-9: Deep Recursive Type Flattening

## Overview
Implement a type-level `DeepFlatten<T>` that recursively flattens nested objects into dot-notation paths, along with a runtime function that mirrors the type transformation.

Given `{ a: { b: { c: number } }, d: string }`, the flattened type should be `{ "a.b.c": number, "d": string }`.

## What You Must Implement

In the file `deep-flatten.ts`, implement and export:

### 1. `DeepFlatten<T>`
A type that takes an object type `T` and produces a new object type where:
- All nested object properties are recursively flattened into dot-notation keys.
- Leaf types (string, number, boolean, arrays, functions) are preserved as-is.
- Empty objects remain as-is (value type `{}`).
- Only plain object types `{ [key: string]: ... }` are recursively descended; arrays, Date, RegExp, etc. are treated as leaves.

Example:
```ts
type Input = {
  a: { b: { c: number } }
  d: string
  e: { f: boolean, g: { h: string[] } }
}
type Output = DeepFlatten<Input>
// { "a.b.c": number, "d": string, "e.f": boolean, "e.g.h": string[] }
```

### 2. `deepFlatten<T>(obj: T): DeepFlatten<T>`
A runtime function that:
- Takes a nested object and returns a new flat object with dot-notation keys.
- Handles recursive nesting to arbitrary depth.
- Treats arrays, Dates, RegExps, null, undefined, and other non-plain-objects as leaf values.
- Returns an empty object `{}` for empty input.

### 3. `DeepUnflatten<T>`
A type that reverses `DeepFlatten` -- given a flat object with dot-notation keys, reconstructs the nested object type.

### 4. `deepUnflatten<T>(obj: T): DeepUnflatten<T>`
A runtime function that reverses `deepFlatten`.

## Key Constraints
- The type must handle up to 6 levels of nesting.
- Keys containing dots in the original object are NOT expected (you may assume all original keys are simple identifiers).
- The runtime functions must be consistent with the types: `deepFlatten` output must satisfy `DeepFlatten<T>` and `deepUnflatten` must reconstruct the original shape.
- Array values, Date, RegExp, Map, Set, functions should all be treated as leaf values (not recursed into).
- Union types in leaf positions must be preserved.
