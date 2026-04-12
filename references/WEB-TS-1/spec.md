# WEB-TS-1: Recursive Collection Setter Types (ArraySetter, TupleSetter, ObjectSetter)

## Source
Adapted from [Web-Bench](https://github.com/bytedance/web-bench) TypeScript project, tasks 8-10. Apache 2.0 license.

## Overview
Implement three advanced generic TypeScript types that dynamically map value types to form setter types for arrays, tuples, and objects. These types must support recursive nesting (e.g., an object containing an array of objects) and enforce strict type correspondence between values and their setter types.

## Context

You are building a type-safe form schema system. The system already has these base setter types defined:

```ts
export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface InputSetter { type: 'input' }
export interface NumberSetter { type: 'number' }
export interface CheckboxSetter { type: 'checkbox' }

// Maps a primitive value type to its corresponding setter
export type ValueSetter<T extends SetterValueType> =
  T extends string ? InputSetter :
  T extends number ? NumberSetter :
  T extends boolean ? CheckboxSetter :
  // YOU MUST EXTEND THIS for arrays, tuples, and objects
  never
```

## What You Must Implement

In the file `setter-types.ts`, implement and export:

### 1. `ArraySetter<Value>`
- Generic parameter `Value` constrained to `SetterValueType[]`
- Has property `type: 'array'`
- Has property `item`: a `ValueSetter` for the array's element type (`Value[number]`)
- Has optional property `value` of type `Value`

### 2. `TupleSetter<Value>`
- Generic parameter `Value` constrained to `SetterValueType[]`
- Has property `type: 'tuple'`
- Has property `items`: a mapped tuple where each element is a `ValueSetter` for the corresponding tuple element
- Has optional property `value` of type `Value`

### 3. `ObjectSetter<Value>`
- Generic parameter `Value` constrained to `{ [key: string]: SetterValueType }`
- Has property `type: 'object'`
- Has property `properties`: an object where each key `K` maps to `ValueSetter<Value[K]>`
- Has optional property `value` of type `Value`

### 4. Update `ValueSetter<T>`
Extend the existing `ValueSetter` type to also handle:
- `T extends SetterValueType[]` -> `ArraySetter<T> | TupleSetter<T>`
- `T extends { [key: string]: SetterValueType }` -> `ObjectSetter<T>`

### 5. Update `Setter`
Export a `Setter` union type that includes all setter types (Input, Number, Checkbox, Array, Tuple, Object). When given a generic `ValueType`, it should resolve to the appropriate setter(s).

## Key Constraints
- All types must support **recursive nesting**: `ArraySetter<string[][]>` should have `item` of type `ArraySetter<string[]>` whose `item` is `InputSetter`.
- `ObjectSetter` properties must enforce strict key-type correspondence: if the value type has `{ a: string, b: number }`, then `properties.a` must be a string setter and `properties.b` must be a number setter.
- Invalid type assignments (e.g., using `NumberSetter` where `InputSetter` is required) must cause TypeScript compilation errors.
- `TupleSetter` items must be positionally typed: `TupleSetter<[string, number]>` requires `items[0]` to be an `InputSetter` and `items[1]` to be a `NumberSetter`.
