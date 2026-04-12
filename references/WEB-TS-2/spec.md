# WEB-TS-2: Generic Setter Union with ValueType Constraint

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, task 12. Apache 2.0 license.

## Overview
Implement a generic `Setter<ValueType>` union type that dispatches to the correct setter interface based on the provided value type generic. The union must support backward compatibility (no generic = accepts any setter) while enforcing strict type safety when a generic is provided. Also implement a `CustomSetter` type that works with any value type.

## Context

You are extending a form schema type system. The following base types are provided as starter code in `setter-union.ts`:

```ts
export type SetterValueType =
  | string | number | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface InputSetter { type: 'input'; value?: string }
export interface NumberSetter { type: 'number'; value?: number }
export interface CheckboxSetter { type: 'checkbox'; value?: boolean }

export interface ArraySetter<V extends SetterValueType[] = SetterValueType[]> {
  type: 'array'
  item: ValueSetter<V[number]>
  value?: V
}

export interface ObjectSetter<V extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType }> {
  type: 'object'
  properties: { [K in keyof V]: ValueSetter<V[K]> }
  value?: V
}
```

## What You Must Implement

### 1. `CustomSetter<ValueType>`
- Has property `type: 'custom'`
- Has property `customType: string`
- Has optional property `value` of type `ValueType`

### 2. `ValueSetter<T>`
A conditional type that maps value types to their corresponding setter:
- `string` -> `InputSetter | CustomSetter<string>`
- `number` -> `NumberSetter | CustomSetter<number>`
- `boolean` -> `CheckboxSetter | CustomSetter<boolean>`
- `T[]` -> `ArraySetter<T> | CustomSetter<T[]>`
- `{...}` -> `ObjectSetter<T> | CustomSetter<T>`

### 3. `Setter<ValueType>`
A union type parameterized by `ValueType` (default: `SetterValueType`):
- When no generic is provided (`Setter`), it must accept ANY valid setter (InputSetter, NumberSetter, CheckboxSetter, ArraySetter, ObjectSetter, CustomSetter)
- When a generic is provided (`Setter<{ a: string }>`), it must only accept setters valid for that type
- `Setter` without generic must be backward-compatible: `const s: Setter = { type: 'input', value: 'str' }` must compile

## Key Constraints
- `Setter<string>` must NOT accept `NumberSetter` or `CheckboxSetter`
- `Setter<boolean>` must NOT accept `ArraySetter`
- `Setter` (no generic) must accept `{ type: 'input', value: 'str' }` without error
- `CustomSetter` must be a valid `Setter` for ANY value type
- `Setter` with object generic must enforce recursive property types in ObjectSetter
- `Setter` with array generic must enforce item type in ArraySetter
