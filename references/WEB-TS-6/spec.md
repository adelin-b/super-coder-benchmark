# WEB-TS-6: Type-Inferred Props from CustomSetterRender

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 17. Apache 2.0 license.

## Overview
Extend a custom setter type system so that the `props` property on `CustomSetter` is automatically inferred from its corresponding `CustomSetterRender` definition. The `props` type must exclude the `value` and `onChange` fields (which are injected by the framework), leaving only the user-defined custom props. Type mismatches in `props` values must cause compilation errors.

## What You Must Implement

In the file `render-props.ts`, implement and export:

### Pre-provided types (already in the file)
The file provides `SetterValueType`, basic setters, `CustomSetterRender`, `ArraySetter`, `ObjectSetter`, `ValueSetter`, and `FormSchema`.

### Your task
Add an optional `props` property to `CustomSetter` where:
- The type is derived from the `CustomSetterRender` definition for the matching `customType`
- `value` and `onChange` are **omitted** from the props (they are framework-injected)
- The remaining props must match the types declared in the render definition

For example, if `CustomSetterRender<string, { test: string }>` is defined, then:
- `props: { test: '123' }` is valid (string matches)
- `props: { test: 123 }` is INVALID (number does not match string)
- `props` is optional (omitting it is valid)

## Key Constraints
- `props` must be typed as `Omit<Parameters<RenderDef['render']>[0], 'value' | 'onChange'>`
- This must work for custom setters at any nesting depth (inside ObjectSetter, ArraySetter, etc.)
- `props` with correct types must compile
- `props` with wrong types must cause a compilation error
- Omitting `props` entirely must compile
