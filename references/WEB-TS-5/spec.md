# WEB-TS-5: CustomSetterRender with Type-Safe Render Definitions

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, tasks 15-16. Apache 2.0 license.

## Overview
Implement a type system that connects custom form setters to their React render components via a type-safe registry. The `FormSchema` must accept a generic `CustomSetterRenderDef` that maps custom type names to their render definitions. Custom setters within the schema must have their `customType` constrained to only valid keys from this registry.

## What You Must Implement

In the file `custom-render.ts`, implement and export:

### Pre-provided types (already in the file)
The file provides `SetterValueType`, basic setter interfaces with `FormValue` generics, `ValueSetter`, `Expression` types, and React's `FC` type alias.

### 1. `CustomSetterRender<ValueType, Props>`
A type with a `render` property that is a React `FC` receiving props:
- All properties from the generic `Props`
- `value` of type `ValueType`
- `onChange: (value: ValueType) => void`

### 2. `CustomSetter<ValueType, ..., CustomSetterRenderDef, CustomType>`
A setter with:
- `type: 'custom'`
- `customType`: constrained to `CustomType` (a key of `CustomSetterRenderDef`)
- Optional `value` of the setter's value type

### 3. Update `FormSchema<T, CustomSetterRenderDef>`
- Accept a second generic `CustomSetterRenderDef` (default `{}`)
- Add optional `customSetterRenderDefinitions` property: an object matching the shape of `CustomSetterRenderDef`
- Thread `CustomSetterRenderDef` through to all nested setters so `customType` is constrained

### 4. Type-safe customType constraint
When a `CustomSetter` is used inside a `FormSchema`, its `customType` must be one of the keys defined in `CustomSetterRenderDef`. Using an undefined key must cause a compilation error.

## Key Constraints
- `customSetterRenderDefinitions` keys must match the keys of `CustomSetterRenderDef`
- `customType: 'customSetterA'` must compile when `CustomSetterRenderDef` has key `customSetterA`
- `customType: 'customSetterB'` must FAIL when only `customSetterA` is defined
- This must work recursively (custom setter inside nested ObjectSetter must still be constrained)
- The render function's props must include both the custom Props and `value`/`onChange`
