# WEB-TS-12: JSON Schema to TypeScript Type

## Overview
Given a JSON Schema object literal (declared `as const`), derive the TypeScript type it represents at the type level. Also provide a runtime validator that returns typed results matching the inferred type.

## What You Must Implement

In the file `schema-infer.ts`, implement and export:

### 1. `InferSchema<S>`
A type that takes a JSON Schema object (as a const type) and produces the TypeScript type it represents. Must handle:

- **`{ type: "string" }`** -> `string`
- **`{ type: "number" }` / `{ type: "integer" }`** -> `number`
- **`{ type: "boolean" }`** -> `boolean`
- **`{ type: "null" }`** -> `null`
- **`{ type: "array", items: S }`** -> `InferSchema<S>[]`
- **`{ type: "object", properties: P, required: R }`** -> object with required keys from R as mandatory, others optional
- **`{ type: "object", properties: P }`** (no required) -> all properties optional
- **`{ enum: [v1, v2, ...] }`** -> union of literal types `v1 | v2 | ...`
- **`{ oneOf: [S1, S2, ...] }`** -> `InferSchema<S1> | InferSchema<S2> | ...`
- **`{ allOf: [S1, S2, ...] }`** -> `InferSchema<S1> & InferSchema<S2> & ...`
- **`{ nullable: true, type: T }`** -> `InferSchema<{type: T}> | null`

### 2. `createValidator<S>(schema: S): (data: unknown) => data is InferSchema<S>`
A runtime type guard function that:
- Takes a JSON Schema object.
- Returns a validation function that checks if data conforms to the schema.
- The returned function narrows the type to `InferSchema<S>`.

### 3. `validate<S>(schema: S, data: unknown): { success: true, data: InferSchema<S> } | { success: false, errors: string[] }`
A runtime function that validates data against a schema and returns typed results.

## Key Constraints
- Schema objects must be declared `as const` for type inference to work.
- Nested schemas (object within object, array of objects) must work recursively.
- The `required` array in object schemas controls which properties are mandatory vs optional at the type level.
- `enum` values must produce a union of literal types, not just `string` or `number`.
- `oneOf` produces a union type; `allOf` produces an intersection type.
- `nullable: true` adds `| null` to any type.
- The runtime validator must be consistent with the inferred types (i.e., if `InferSchema` says it's `string`, the validator must check for string).
