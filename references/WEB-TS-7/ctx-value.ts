// Reference implementation for WEB-TS-7: Context-Aware ctxValue
// Adapted from Web-Bench TypeScript project task 18 (Apache 2.0)

export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface ExpressionEvent<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormulaValue,
> {
  value: SetterValue
  formValue: FormulaValue
  ctxValue: CtxValue
}

export interface Expression<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
  ExpressionValue,
  CtxValue extends SetterValueType = FormulaValue,
> {
  type: 'expression'
  value: (ctx: ExpressionEvent<SetterValue, FormulaValue, CtxValue>) => ExpressionValue
}

export type SetterMaybeExpression<
  SetterValue extends SetterValueType,
  FormulaValue extends { [key: string]: SetterValueType },
  ExpressionValue,
  CtxValue extends SetterValueType = FormulaValue,
> = Expression<SetterValue, FormulaValue, ExpressionValue, CtxValue> | ExpressionValue

export interface InputSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> {
  type: 'input'
  value?: SetterMaybeExpression<string, FormValue, string, CtxValue>
  visible?: SetterMaybeExpression<string, FormValue, boolean, CtxValue>
}

export interface NumberSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> {
  type: 'number'
  value?: SetterMaybeExpression<number, FormValue, number, CtxValue>
  visible?: SetterMaybeExpression<number, FormValue, boolean, CtxValue>
}

export interface CheckboxSetter<
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> {
  type: 'checkbox'
  value?: SetterMaybeExpression<boolean, FormValue, boolean, CtxValue>
  visible?: SetterMaybeExpression<boolean, FormValue, boolean, CtxValue>
}

export interface ArraySetter<
  Value extends SetterValueType[] = SetterValueType[],
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> {
  type: 'array'
  // Key insight: item's CtxValue is Value[number] (the array element type)
  item: ValueSetter<Value[number], FormValue, Value[number]>
  value?: Value
  visible?: SetterMaybeExpression<Value, FormValue, boolean, CtxValue>
}

export interface ObjectSetter<
  Value extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> {
  type: 'object'
  properties: { [K in keyof Value]: ValueSetter<Value[K], FormValue, CtxValue> }
  value?: Value
  visible?: SetterMaybeExpression<Value, FormValue, boolean, CtxValue>
}

export type ValueSetter<
  T extends SetterValueType = SetterValueType,
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> = T extends string
  ? InputSetter<FormValue, CtxValue>
  : T extends number
    ? NumberSetter<FormValue, CtxValue>
    : T extends boolean
      ? CheckboxSetter<FormValue, CtxValue>
      : T extends SetterValueType[]
        ? ArraySetter<T, FormValue, CtxValue>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T, FormValue, CtxValue>
          : never

export type Setter<
  ValueType extends SetterValueType = SetterValueType,
  FormValue extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  CtxValue extends SetterValueType = FormValue,
> =
  | InputSetter<FormValue, CtxValue>
  | NumberSetter<FormValue, CtxValue>
  | CheckboxSetter<FormValue, CtxValue>
  | ArraySetter<ValueType extends SetterValueType[] ? ValueType : never, FormValue, CtxValue>
  | ObjectSetter<
      ValueType extends { [key: string]: SetterValueType } ? ValueType : never,
      FormValue,
      CtxValue
    >

export interface FormSchema<T extends { [key: string]: SetterValueType }> {
  fields: ValueSetter<T, T, T>
}
