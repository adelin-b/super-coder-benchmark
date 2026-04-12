# WEB-TS-8: Type-Safe Nested Path Access (EditorRef)

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 20. Apache 2.0 license.

## Overview
Implement an `EditorRef` interface with a `setSetterValueByPath` method that accepts a type-safe array of nested property keys. The path array must only contain valid nested keys of the form value type, and the value parameter must match the type at that nested path. This is one of the hardest TypeScript type-level programming challenges in Web-Bench.

## What You Must Implement

In the file `editor-ref.ts`, implement and export:

### Pre-provided types (already in the file)
The file provides `SetterValueType`.

### `EditorRef<T>`
An interface parameterized by `T extends { [key: string]: SetterValueType }` with:

- `setSetterValueByPath<P>(path, value)`:
  - `path`: an array of property keys representing a path into the nested object `T`
  - `value`: must be typed to match the property type at the end of the path
  - Returns `void`

For example, given:
```ts
type TestValue = {
  name: string
  object: { age: number }
}
const ref: EditorRef<TestValue> = {} as any
ref.setSetterValueByPath(['object'], { age: 12 })     // valid
ref.setSetterValueByPath(['object'], { age: "12" })    // ERROR: age should be number
ref.setSetterValueByPath(['name'], "hello")             // valid
ref.setSetterValueByPath(['name'], 123)                 // ERROR: name should be string
```

## Key Constraints
- Path `['object']` with value `{ age: 12 }` must compile
- Path `['object']` with value `{ age: "12" }` must FAIL (wrong nested type)
- Path `['name']` with value `"hello"` must compile
- Path `['name']` with value `123` must FAIL
- The path generic `P` must be constrained to valid key sequences
- Single-level paths (e.g., `['name']`) must work
- Multi-level paths (e.g., `['object', 'age']` if supported) are bonus but not required for the base test cases
