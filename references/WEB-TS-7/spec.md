# WEB-TS-7: Context-Aware ctxValue in Array Setters

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 18. Apache 2.0 license.

## Overview
Implement a context value (`ctxValue`) system for expression callbacks in a form schema. When a setter is inside an `ArraySetter`, the `ctxValue` in its expression context should be typed to the array item type (representing the current array element). When NOT inside an `ArraySetter`, `ctxValue` defaults to the `FormValue` type. This requires threading a `CtxValue` generic through all setter types.

## What You Must Implement

In the file `ctx-value.ts`, implement and export:

### Pre-provided types (already in the file)
The file provides `SetterValueType`, `ExpressionEvent` (without ctxValue), `Expression`, `SetterMaybeExpression`, basic setters, and `FormSchema`.

### Your task
1. Add a `ctxValue` property to `ExpressionEvent` with a generic `CtxValue` type parameter
2. Add a `CtxValue` generic to all setter types that flows through to their expression types
3. In `ArraySetter`, the `item` setter's `CtxValue` should be set to the array element type (`Value[number]`)
4. Outside `ArraySetter`, `CtxValue` defaults to `FormValue`
5. This must work recursively: an array inside an object inside a FormSchema

## Key Constraints
- Inside `ArraySetter<string[]>`, the item's expression `ctxValue` must be `string`
- Outside any `ArraySetter`, `ctxValue` defaults to the form value type
- Nested arrays: `ArraySetter` inside `ObjectSetter` inside `ArraySetter` -- the innermost ctxValue is the inner array's element type
- `ctxValue` type must be correct in `FormSchema` context (threaded through from the root)
- Accessing `ctx.ctxValue` with wrong type must cause a compilation error
