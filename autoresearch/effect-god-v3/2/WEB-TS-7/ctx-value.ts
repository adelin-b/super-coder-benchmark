export type SetterValueType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type ExpressionEvent<FormValue, CtxValue = FormValue> = {
  formValue: FormValue;
  ctxValue: CtxValue;
};

export type Expression<FormValue, CtxValue = FormValue> = (
  ctx: ExpressionEvent<FormValue, CtxValue>
) => boolean;

export type SetterMaybeExpression<T, FormValue, CtxValue = FormValue> =
  | T
  | Expression<FormValue, CtxValue>;

export type StringSetter<FormValue, CtxValue = FormValue> = {
  type: 'string';
  defaultValue?: string;
  visible?: SetterMaybeExpression<boolean, FormValue, CtxValue>;
};

export type NumberSetter<FormValue, CtxValue = FormValue> = {
  type: 'number';
  defaultValue?: number;
  visible?: SetterMaybeExpression<boolean, FormValue, CtxValue>;
};

export type BooleanSetter<FormValue, CtxValue = FormValue> = {
  type: 'boolean';
  defaultValue?: boolean;
  visible?: SetterMaybeExpression<boolean, FormValue, CtxValue>;
};

export type ObjectSetter<
  Value extends Record<string, any>,
  FormValue,
  CtxValue = FormValue
> = {
  type: 'object';
  properties: { [K in keyof Value]: Setter<Value[K], FormValue, CtxValue> };
  visible?: SetterMaybeExpression<boolean, FormValue, CtxValue>;
};

export type ArraySetter<
  Value extends any[],
  FormValue,
  CtxValue = FormValue
> = {
  type: 'array';
  item: Setter<Value[number], FormValue, Value[number]>;
  visible?: SetterMaybeExpression<boolean, FormValue, CtxValue>;
};

export type Setter<Value, FormValue, CtxValue = FormValue> =
  Value extends (infer _U)[]
    ? ArraySetter<Extract<Value, any[]>, FormValue, CtxValue>
    : Value extends Record<string, any>
      ? ObjectSetter<Value, FormValue, CtxValue>
      : Value extends string
        ? StringSetter<FormValue, CtxValue>
        : Value extends number
          ? NumberSetter<FormValue, CtxValue>
          : Value extends boolean
            ? BooleanSetter<FormValue, CtxValue>
            : StringSetter<FormValue, CtxValue>
              | NumberSetter<FormValue, CtxValue>
              | BooleanSetter<FormValue, CtxValue>;

export type FormSchema<FormValue> = {
  [K in keyof FormValue]: Setter<FormValue[K], FormValue, FormValue>;
};