// Reference implementation for WEB-TS-1: Recursive Collection Setter Types
// Adapted from Web-Bench TypeScript project (Apache 2.0)

export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface InputSetter {
  type: 'input'
  value?: string
}

export interface NumberSetter {
  type: 'number'
  value?: number
}

export interface CheckboxSetter {
  type: 'checkbox'
  value?: boolean
}

export interface ArraySetter<Value extends SetterValueType[] = SetterValueType[]> {
  type: 'array'
  item: ValueSetter<Value[number]>
  value?: Value
}

type ToValueSetterTuple<T extends SetterValueType[]> = {
  [K in keyof T]: ValueSetter<T[K]>
}

export interface TupleSetter<Value extends SetterValueType[] = SetterValueType[]> {
  type: 'tuple'
  items: ToValueSetterTuple<Value>
  value?: Value
}

export interface ObjectSetter<
  Value extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'object'
  properties: {
    [K in keyof Value]: ValueSetter<Value[K]>
  }
  value?: Value
}

export type ValueSetter<T extends SetterValueType = SetterValueType> = T extends string
  ? InputSetter
  : T extends number
    ? NumberSetter
    : T extends boolean
      ? CheckboxSetter
      : T extends SetterValueType[]
        ? ArraySetter<T> | TupleSetter<T>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T>
          : never

export type Setter<ValueType extends SetterValueType = SetterValueType> =
  | InputSetter
  | NumberSetter
  | CheckboxSetter
  | ArraySetter<ValueType extends SetterValueType[] ? ValueType : never>
  | TupleSetter<ValueType extends SetterValueType[] ? ValueType : never>
  | ObjectSetter<ValueType extends { [key: string]: SetterValueType } ? ValueType : never>
