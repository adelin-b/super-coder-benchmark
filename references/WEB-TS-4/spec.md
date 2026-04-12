# WEB-TS-4: Conditional Visibility with Expression Props

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 14. Apache 2.0 license.

## Overview
Extend a form setter type system with a `visible` property that can be either a boolean literal or an expression callback. The expression callback receives typed context including the setter's own value and the entire form's value, and must return a boolean. FormSchema must thread the form value type through to all nested setters.

## What You Must Implement

In the file `visible-setter.ts`, implement and export:

### Pre-provided types (already in the file)
The file provides `SetterValueType`, basic setter interfaces, `ArraySetter`, `ObjectSetter`, `ExpressionEvent`, `Expression`, `SetterMaybeExpression`.

### Your task
1. Add an optional `visible` property to all setter types. The `visible` property must be a `SetterMaybeExpression` where:
   - The ExpressionValue is `boolean`
   - The FormValue comes from a second generic parameter on each setter
   - When no FormValue generic is provided, it defaults to `{ [key: string]: SetterValueType }`

2. Update `ValueSetter` and `FormSchema` so that `FormSchema<FormValue>` threads the `FormValue` type through to all nested setters, making `visible` expressions correctly typed.

3. All setters must accept a second generic `FormValue` that flows into their `visible` expression's context.

## Key Constraints
- `visible` must be optional on all setters
- `visible: true` and `visible: false` must be valid (literal boolean)
- `visible: { type: 'expression', value: (ctx) => ctx.formValue.someField }` must be valid when `someField` exists in FormValue
- Within a FormSchema, the expression callback's `ctx.formValue` must be typed to the schema's form value type
- Omitting `visible` entirely must compile without errors
