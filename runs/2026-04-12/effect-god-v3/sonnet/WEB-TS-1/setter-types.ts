export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface InputSetter { type: 'input' }
export interface NumberSetter { type: 'number' }
export interface CheckboxSetter { type: 'checkbox' }

export interface ArraySetter<Value extends SetterValueType[]> {
  type: 'array'
  item: ValueSetter<Value[number]>
  value?: Value
}

export interface TupleSetter<Value extends SetterValueType[]> {
  type: 'tuple'
  items: { [K in keyof Value]: Value[K] extends SetterValueType ? ValueSetter<Value[K]> : never }
  value?: Value
}

export interface ObjectSetter<Value extends { [key: string]: SetterValueType }> {
  type: 'object'
  properties: { [K in keyof Value]: ValueSetter<Value[K]> }
  value?: Value
}

export type ValueSetter<T extends SetterValueType> =
  T extends string ? InputSetter :
  T extends number ? NumberSetter :
  T extends boolean ? CheckboxSetter :
  T extends { [key: string]: SetterValueType } ? ObjectSetter<T> :
  T extends SetterValueType[] ? ArraySetter<T> | TupleSetter<T> :
  never

export type Setter<ValueType extends SetterValueType = SetterValueType> =
  ValueType extends string ? InputSetter :
  ValueType extends number ? NumberSetter :
  ValueType extends boolean ? CheckboxSetter :
  ValueType extends { [key: string]: SetterValueType } ? ObjectSetter<ValueType> :
  ValueType extends SetterValueType[] ? ArraySetter<ValueType> | TupleSetter<ValueType> :
  never