// Reference implementation for WEB-TS-2: Generic Setter Union
// Adapted from Web-Bench TypeScript project task 12 (Apache 2.0)

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

export interface ArraySetter<
  Value extends SetterValueType[] = SetterValueType[],
> {
  type: 'array'
  item: ValueSetter<Value[number]>
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

export interface CustomSetter<
  ValueType extends SetterValueType = SetterValueType,
> {
  type: 'custom'
  customType: string
  value?: ValueType
}

export type ValueSetter<T extends SetterValueType = SetterValueType> = T extends string
  ? InputSetter | CustomSetter<T>
  : T extends number
    ? NumberSetter | CustomSetter<T>
    : T extends boolean
      ? CheckboxSetter | CustomSetter<T>
      : T extends SetterValueType[]
        ? ArraySetter<T> | CustomSetter<T>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T> | CustomSetter<T>
          : CustomSetter<T>

export type Setter<
  ValueType extends SetterValueType = SetterValueType,
> =
  | InputSetter
  | NumberSetter
  | CheckboxSetter
  | ArraySetter<ValueType extends SetterValueType[] ? ValueType : never>
  | ObjectSetter<ValueType extends { [key: string]: SetterValueType } ? ValueType : never>
  | CustomSetter<ValueType>
