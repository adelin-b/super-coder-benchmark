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

export interface CustomSetter<ValueType = SetterValueType> {
  type: 'custom'
  customType: string
  value?: ValueType
}

export type ValueSetter<T extends SetterValueType> =
  T extends string
    ? InputSetter | CustomSetter<string>
    : T extends number
      ? NumberSetter | CustomSetter<number>
      : T extends boolean
        ? CheckboxSetter | CustomSetter<boolean>
        : T extends SetterValueType[]
          ? ArraySetter<T> | CustomSetter<T>
          : T extends { [key: string]: SetterValueType }
            ? ObjectSetter<T> | CustomSetter<T>
            : never

export type Setter<ValueType extends SetterValueType = SetterValueType> = ValueSetter<ValueType>