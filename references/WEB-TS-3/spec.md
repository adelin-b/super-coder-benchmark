# WEB-TS-3: FormSchema with Expression Types

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 13. Apache 2.0 license.

## Overview
Implement a type-safe form schema system with expression types. The schema must map form value types to their corresponding setter types, and support expression callbacks that receive typed context (setter value + form value).

## What You Must Implement

In the file `form-schema.ts`, implement and export:

### Pre-provided types (already in the file)
The file already contains `SetterValueType`, `InputSetter`, `NumberSetter`, `CheckboxSetter`, `ArraySetter`, `ObjectSetter`, and `ValueSetter`.

### 1. `ExpressionEvent<SetterValue, FormValue>`
An interface with:
- `value`: of type `SetterValue` (constrained to `SetterValueType`)
- `formValue`: of type `FormValue` (constrained to `{ [key: string]: SetterValueType }`)

### 2. `Expression<SetterValue, FormValue, ExpressionValue>`
An interface with:
- `type: 'expression'`
- `value`: a function `(ctx: ExpressionEvent<SetterValue, FormValue>) => ExpressionValue`

### 3. `SetterMaybeExpression<SetterValue, FormValue, ExpressionValue>`
A union type: either an `Expression<SetterValue, FormValue, ExpressionValue>` or just the `ExpressionValue` directly.

### 4. `FormSchema<T>`
An interface parameterized by `T extends { [key: string]: SetterValueType }`:
- `fields`: a `ValueSetter<T>` (the root setter for the entire form)

## Key Constraints
- `ExpressionEvent` requires both generic parameters (no defaults) -- using it without generics must cause an error
- `ExpressionEvent`'s `FormValue` must be constrained to object types (not strings, numbers, etc.)
- `Expression.value` callback parameter must be correctly typed with both `value` and `formValue`
- `FormSchema` fields must enforce type correspondence (e.g., `FormSchema<{a: string}>` requires an InputSetter for field `a`)
- `SetterMaybeExpression` must accept both raw values and expression objects
