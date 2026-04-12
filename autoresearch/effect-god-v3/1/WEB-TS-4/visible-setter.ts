// SetterValueType: the union of all primitive and composite values a setter can hold
export type SetterValueType =
  | string
  | number
  | boolean
  | null
  | undefined
  | SetterValueType[]
  | { [key: string]: SetterValueType };

// ExpressionEvent: context object passed into expression callbacks
export interface ExpressionEvent<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> {
  ctxValue: SetterValueType;
  formValue: FormValue;
}

// Expression: an expression object carrying a typed callback
export interface Expression<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> {
  type: "expression";
  value: (ctx: ExpressionEvent<ExpressionValue, FormValue>) => ExpressionValue;
}

// SetterMaybeExpression: either a plain value or an Expression object
export type SetterMaybeExpression<
  ExpressionValue,
  FormValue = { [key: string]: SetterValueType }
> = ExpressionValue | Expression<ExpressionValue, FormValue>;

// ValueSetter: a leaf setter for primitive / simple values
export interface ValueSetter<
  FormValue = { [key: string]: SetterValueType }
> {
  type: string;
  visible?: SetterMaybeExpression<boolean, FormValue>;
  [key: string]: unknown;
}

// ArraySetter: a setter whose value is an array; items describes each element
export interface ArraySetter<
  T extends SetterValueType[] = SetterValueType[],
  FormValue = { [key: string]: SetterValueType }
> {
  type: "array";
  items: Setter<FormValue>;
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

// ObjectSetter: a setter whose value is an object; properties describes each field
export interface ObjectSetter<
  T extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
  FormValue = { [key: string]: SetterValueType }
> {
  type: "object";
  properties: { [key: string]: Setter<FormValue> };
  visible?: SetterMaybeExpression<boolean, FormValue>;
}

// Setter: discriminated union of all setter variants
export type Setter<FormValue = { [key: string]: SetterValueType }> =
  | ValueSetter<FormValue>
  | ArraySetter<SetterValueType[], FormValue>
  | ObjectSetter<{ [key: string]: SetterValueType }, FormValue>;

// FormSchema: a map of field names to setters, threaded with FormValue
export type FormSchema<FormValue = { [key: string]: SetterValueType }> = {
  [key: string]: Setter<FormValue>;
};