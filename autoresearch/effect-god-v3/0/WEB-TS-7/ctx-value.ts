// SetterValueType: maps a setter type to its value type
export type SetterValueType<S> =
  S extends StringSetter<any, any> ? string :
  S extends NumberSetter<any, any> ? number :
  S extends ArraySetter<infer V, any, any> ? V :
  S extends ObjectSetter<infer V, any, any> ? V :
  never;

// ExpressionEvent carries both the overall form value and the context value
// (which changes to the array element type when inside an ArraySetter)
export interface ExpressionEvent<FormValue, CtxValue = FormValue> {
  formValue: FormValue;
  ctxValue: CtxValue;
}

// A function that receives the expression event and returns a computed value
export type Expression<FormValue, CtxValue, Return> =
  (ctx: ExpressionEvent<FormValue, CtxValue>) => Return;

// A field can be a static value or a dynamic expression
export type SetterMaybeExpression<FormValue, CtxValue, Value> =
  Value | Expression<FormValue, CtxValue, Value>;

// StringSetter: binds a string field; CtxValue flows in from the parent
export interface StringSetter<FormValue = any, CtxValue = FormValue> {
  type: 'StringSetter';
  defaultValue?: SetterMaybeExpression<FormValue, CtxValue, string>;
}

// NumberSetter: binds a number field; CtxValue flows in from the parent
export interface NumberSetter<FormValue = any, CtxValue = FormValue> {
  type: 'NumberSetter';
  defaultValue?: SetterMaybeExpression<FormValue, CtxValue, number>;
}

// ArraySetter: the critical type — its own expressions use the outer CtxValue,
// but the item setter receives CtxValue = Value[number] (the array element type)
export interface ArraySetter<
  Value extends any[] = any[],
  FormValue = any,
  CtxValue = FormValue
> {
  type: 'ArraySetter';
  // item uses Value[number] as CtxValue, so expressions inside see the element type
  item: Setter<FormValue, Value[number]>;
  defaultValue?: SetterMaybeExpression<FormValue, CtxValue, Value>;
}

// ObjectSetter: passes CtxValue through unchanged to all its properties
export interface ObjectSetter<
  Value extends Record<string, any> = Record<string, any>,
  FormValue = any,
  CtxValue = FormValue
> {
  type: 'ObjectSetter';
  // properties inherit the same CtxValue from the enclosing context
  properties: {
    [K in keyof Value]: Setter<FormValue, CtxValue>;
  };
  defaultValue?: SetterMaybeExpression<FormValue, CtxValue, Value>;
}

// Union of all setter kinds; both FormValue and CtxValue are threaded through
export type Setter<FormValue = any, CtxValue = FormValue> =
  | StringSetter<FormValue, CtxValue>
  | NumberSetter<FormValue, CtxValue>
  | ArraySetter<any[], FormValue, CtxValue>
  | ObjectSetter<any, FormValue, CtxValue>;

// Top-level schema: CtxValue starts as FormValue for every root-level setter
export type FormSchema<FormValue extends Record<string, any>> = {
  [K in keyof FormValue]: Setter<FormValue, FormValue>;
};