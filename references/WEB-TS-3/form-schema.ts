// Reference implementation for WEB-TS-3: FormSchema with Expression Types
// Adapted from Web-Bench TypeScript project task 13 (Apache 2.0)

export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

export interface InputSetter { type: 'input'; value?: string }
export interface NumberSetter { type: 'number'; value?: number }
export interface CheckboxSetter { type: 'checkbox'; value?: boolean }

export interface ArraySetter<Value extends SetterValueType[] = SetterValueType[]> {
  type: 'array'
  item: ValueSetter<Value[number]>
  value?: Value
}

export interface ObjectSetter<
  Value extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  type: 'object'
  properties: { [K in keyof Value]: ValueSetter<Value[K]> }
  value?: Value
}

export type ValueSetter<T extends SetterValueType = SetterValueType> = T extends string
  ? InputSetter
  : T extends number
    ? NumberSetter
    : T extends boolean
      ? CheckboxSetter
      : T extends SetterValueType[]
        ? ArraySetter<T>
        : T extends { [key: string]: SetterValueType }
          ? ObjectSetter<T>
          : never

// --- Implement below ---

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

export interface FormSchema<
  T extends { [key: string]: SetterValueType },
> {
  fields: ValueSetter<T>
}
