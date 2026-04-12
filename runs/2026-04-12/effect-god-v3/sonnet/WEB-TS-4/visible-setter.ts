export type SetterValueType = string | number | boolean | object | null | undefined;

export interface ExpressionEvent<ExpressionValue, FormValue = { [key: string]: SetterValueType }> {
  value: ExpressionValue;
  formValue: FormValue;
}

export interface Expression<ExpressionValue, FormValue = { [key: string]: SetterValueType }> {
  type: "expression";
  value: (ctx: ExpressionEvent<ExpressionValue, FormValue>) => ExpressionValue;
}

export type SetterMaybeExpression<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> = ExpressionValue | Expression<ExpressionValue, FormValue>;

export interface ValueSetter<FormValue = { [key: string]: SetterValueType }> {
  type: "string" | "number" | "boolean" | "select" | "color" | "text";
  defaultValue?: SetterValueType;
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export interface ArraySetter<FormValue = { [key: string]: SetterValueType }> {
  type: "array";
  item: Setter<FormValue>;
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export interface ObjectSetter<FormValue = { [key: string]: SetterValueType }> {
  type: "object";
  properties: { [key: string]: Setter<FormValue> };
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

export type Setter<FormValue = { [key: string]: SetterValueType }> =
  | ValueSetter<FormValue>
  | ArraySetter<FormValue>
  | ObjectSetter<FormValue>;

export type FormSchema<FormValue = { [key: string]: SetterValueType }> = {
  [K in keyof FormValue]?: Setter<FormValue>;
};