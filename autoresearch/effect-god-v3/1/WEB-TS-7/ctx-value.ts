// ctx-value.ts

// ---------------------------------------------------------------------------
// Foundation
// ---------------------------------------------------------------------------

/** The default root context type when not inside an ArraySetter. */
export type FormValue = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Expression infrastructure
// ---------------------------------------------------------------------------

/**
 * The event object passed to every expression callback.
 * - `value`    : the current value of the field this setter controls
 * - `ctxValue` : the surrounding context — defaults to `FormValue` at the
 *                root, but becomes `Value[number]` inside an `ArraySetter`
 */
export type ExpressionEvent<Value, CtxValue = FormValue> = {
  value: Value;
  ctxValue: CtxValue;
};

/** A callback that receives an ExpressionEvent and returns `Return`. */
export type Expression<Value, Return, CtxValue = FormValue> = (
  ctx: ExpressionEvent<Value, CtxValue>
) => Return;

/** A literal value **or** an expression that produces that value at runtime. */
export type SetterMaybeExpression<Value, Return, CtxValue = FormValue> =
  | Return
  | Expression<Value, Return, CtxValue>;

// ---------------------------------------------------------------------------
// SetterValueType — canonical mapping of setter-name → value type
// ---------------------------------------------------------------------------

export type SetterValueType = {
  StringSetter: string;
  NumberSetter: number;
  BooleanSetter: boolean;
  BoolSetter: boolean;
  SelectSetter: string;
  ArraySetter: unknown[];
  ObjectSetter: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Leaf setters
// ---------------------------------------------------------------------------

export type StringSetter<CtxValue = FormValue> = {
  type: "StringSetter";
  visible?: SetterMaybeExpression<string, boolean, CtxValue>;
  defaultValue?: SetterMaybeExpression<string, string, CtxValue>;
  label?: string;
};

export type NumberSetter<CtxValue = FormValue> = {
  type: "NumberSetter";
  visible?: SetterMaybeExpression<number, boolean, CtxValue>;
  defaultValue?: SetterMaybeExpression<number, number, CtxValue>;
  label?: string;
};

export type BooleanSetter<CtxValue = FormValue> = {
  type: "BooleanSetter";
  visible?: SetterMaybeExpression<boolean, boolean, CtxValue>;
  defaultValue?: SetterMaybeExpression<boolean, boolean, CtxValue>;
  label?: string;
};

export type BoolSetter<CtxValue = FormValue> = {
  type: "BoolSetter";
  visible?: SetterMaybeExpression<boolean, boolean, CtxValue>;
  defaultValue?: SetterMaybeExpression<boolean, boolean, CtxValue>;
  label?: string;
};

export type SelectSetter<CtxValue = FormValue> = {
  type: "SelectSetter";
  options: string[];
  visible?: SetterMaybeExpression<string, boolean, CtxValue>;
  defaultValue?: SetterMaybeExpression<string, string, CtxValue>;
  label?: string;
};

// ---------------------------------------------------------------------------
// ArraySetter
// The critical rule: the `item` setter's CtxValue = Value[number]
// (the element type of the array), NOT the outer CtxValue.
// ---------------------------------------------------------------------------

export type ArraySetter<
  Value extends unknown[] = unknown[],
  CtxValue = FormValue
> = {
  type: "ArraySetter";
  /** The setter that describes each element. Its CtxValue = element type. */
  item: Setter<Value[number], Value[number]>;
  visible?: SetterMaybeExpression<Value, boolean, CtxValue>;
  label?: string;
};

// ---------------------------------------------------------------------------
// ObjectSetter
// Threads the same CtxValue through to every child setter.
// ---------------------------------------------------------------------------

export type ObjectSetter<
  Value extends Record<string, unknown> = Record<string, unknown>,
  CtxValue = FormValue
> = {
  type: "ObjectSetter";
  items: { [K in keyof Value]: Setter<Value[K], CtxValue> };
  visible?: SetterMaybeExpression<Value, boolean, CtxValue>;
  label?: string;
};

// ---------------------------------------------------------------------------
// Setter<Value, CtxValue>
// Dispatches to the correct concrete setter based on Value's shape.
// CtxValue flows through to every expression callback.
// ---------------------------------------------------------------------------

export type Setter<Value, CtxValue = FormValue> = [Value] extends [string]
  ? StringSetter<CtxValue> | SelectSetter<CtxValue>
  : [Value] extends [number]
  ? NumberSetter<CtxValue>
  : [Value] extends [boolean]
  ? BooleanSetter<CtxValue> | BoolSetter<CtxValue>
  : [Value] extends [unknown[]]
  ? ArraySetter<Extract<Value, unknown[]>, CtxValue>
  : [Value] extends [Record<string, unknown>]
  ? ObjectSetter<Extract<Value, Record<string, unknown>>, CtxValue>
  :
      | StringSetter<CtxValue>
      | NumberSetter<CtxValue>
      | BooleanSetter<CtxValue>
      | BoolSetter<CtxValue>
      | SelectSetter<CtxValue>
      | ArraySetter<unknown[], CtxValue>
      | ObjectSetter<Record<string, unknown>, CtxValue>;

// ---------------------------------------------------------------------------
// FormSchema
// At the root level CtxValue = the entire form value type (Value).
// ---------------------------------------------------------------------------

export type FormSchema<Value extends FormValue = FormValue> = {
  [K in keyof Value]: Setter<Value[K], Value>;
};