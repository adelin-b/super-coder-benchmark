export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface ExpressionEvent<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
> {
  value: SetterValue
  formValue: FormulaValue
}

export interface Expression<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
  ExpressionValue,
> {
  type: 'expression'
  value: (ctx: ExpressionEvent<SetterValue, FormulaValue>) => ExpressionValue
}

export type SetterMaybeExpression<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
  ExpressionValue,
> = Expression<SetterValue, FormulaValue, ExpressionValue> | ExpressionValue

export interface InputSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'input'
  value?: string
  visible?: SetterMaybeExpression<string, FormValue, boolean>
}

export interface NumberSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'number'
  value?: number
  visible?: SetterMaybeExpression<number, FormValue, boolean>
}

export interface CheckboxSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'checkbox'
  value?: boolean
  visible?: SetterMaybeExpression<boolean, FormValue, boolean>
}

export interface ArraySetter<
  Value extends SetterValueType[] = SetterValueType[],
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'array'
  item: ValueSetter<Value[number], FormValue>
  value?: Value
  visible?: SetterMaybeExpression<Value, FormValue, boolean>
}

export interface ObjectSetter<
  Value extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'object'
  properties: { [K in keyof Value]: ValueSetter<Value[K], FormValue> }
  value?: Value
  visible?: SetterMaybeExpression<Value, FormValue, boolean>
}

export type ValueSetter<
  T extends SetterValueType = SetterValueType,
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> = T extends string
  ? InputSetter<FormValue>
  : T extends number
    ? NumberSetter<FormValue>
    : T extends boolean
      ? CheckboxSetter<FormValue>
      : T extends SetterValueType[]
        ? ArraySetter<T, FormValue>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T, FormValue>
          : never

export type Setter<
  ValueType extends SetterValueType = SetterValueType,
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> =
  | InputSetter<FormValue>
  | NumberSetter<FormValue>
  | CheckboxSetter<FormValue>
  | ArraySetter<ValueType extends SetterValueType[] ? ValueType : never, FormValue>
  | ObjectSetter<
      ValueType extends { [key: string]: SetterValueType } ? ValueType : never,
      FormValue
    >

export interface FormSchema<T extends { [key: string]: SetterValueType }> {
  fields: ValueSetter<T, T>
}