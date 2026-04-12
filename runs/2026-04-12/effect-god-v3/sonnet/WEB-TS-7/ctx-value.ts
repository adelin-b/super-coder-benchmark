// ─── Pre-provided foundations ────────────────────────────────────────────────

/** Union of all primitive/composite value types a setter can carry. */
export type SetterValueType =
  | string
  | number
  | boolean
  | unknown[]
  | Record<string, unknown>;

/**
 * The default "context value" type when a setter lives outside any ArraySetter.
 * Represents the entire form's data shape.
 */
export type FormValue = Record<string, unknown>;

// ─── Expression primitives ───────────────────────────────────────────────────

/**
 * The event object passed into every expression callback.
 *
 * @typeParam Value    – the field's own value type
 * @typeParam CtxValue – the array-item type when inside an ArraySetter,
 *                       or FormValue when at the top level
 */
export interface ExpressionEvent<Value, CtxValue = FormValue> {
  value: Value;
  ctxValue: CtxValue;
}

/** A callback that derives `Value` from the expression event. */
export type Expression<Value, CtxValue = FormValue> = (
  event: ExpressionEvent<Value, CtxValue>
) => Value;

/** A field may be a static value **or** a dynamic expression. */
export type SetterMaybeExpression<Value, CtxValue = FormValue> =
  | Value
  | Expression<Value, CtxValue>;

// ─── Basic setters ───────────────────────────────────────────────────────────

export interface InputSetter<CtxValue = FormValue> {
  type: "input";
  value?: SetterMaybeExpression<string, CtxValue>;
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

export interface SelectSetter<CtxValue = FormValue> {
  type: "select";
  options: string[];
  value?: SetterMaybeExpression<string, CtxValue>;
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

export interface NumberSetter<CtxValue = FormValue> {
  type: "number";
  value?: SetterMaybeExpression<number, CtxValue>;
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

export interface BooleanSetter<CtxValue = FormValue> {
  type: "boolean";
  value?: SetterMaybeExpression<boolean, CtxValue>;
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

// ─── Composite setters ───────────────────────────────────────────────────────

/**
 * Setter for an object-shaped value.
 * Each property setter inherits the same `CtxValue` as the parent.
 */
export interface ObjectSetter<
  Value extends Record<string, unknown>,
  CtxValue = FormValue
> {
  type: "object";
  properties: {
    [K in keyof Value]: Setter<Value[K], CtxValue>;
  };
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

/**
 * Setter for an array-shaped value.
 *
 * The `item` setter's `CtxValue` is set to `Value[number]` (the element type),
 * so that expression callbacks inside the item see the current array element
 * as `ctxValue`.
 */
export interface ArraySetter<Value extends unknown[], CtxValue = FormValue> {
  type: "array";
  /** Item setter – CtxValue is narrowed to the array's element type. */
  item: Setter<Value[number], Value[number]>;
  label?: SetterMaybeExpression<string, CtxValue>;
  disabled?: SetterMaybeExpression<boolean, CtxValue>;
  hidden?: SetterMaybeExpression<boolean, CtxValue>;
}

// ─── Setter dispatch ─────────────────────────────────────────────────────────

/**
 * Maps a `Value` type to the appropriate setter interface,
 * threading `CtxValue` through to every expression.
 *
 * Resolution order:
 *   unknown[]              → ArraySetter  (checked before Record to avoid overlap)
 *   string                 → InputSetter | SelectSetter
 *   number                 → NumberSetter
 *   boolean                → BooleanSetter
 *   Record<string,unknown> → ObjectSetter
 */
export type Setter<Value, CtxValue = FormValue> = Value extends unknown[]
  ? ArraySetter<Value, CtxValue>
  : Value extends string
  ? InputSetter<CtxValue> | SelectSetter<CtxValue>
  : Value extends number
  ? NumberSetter<CtxValue>
  : Value extends boolean
  ? BooleanSetter<CtxValue>
  : Value extends Record<string, unknown>
  ? ObjectSetter<Value, CtxValue>
  : never;

// ─── FormSchema ───────────────────────────────────────────────────────────────

/**
 * Top-level schema for the whole form.
 * Every setter at this level receives `CtxValue = FV` (the full form value),
 * meaning `ctxValue` in expression callbacks equals the form's data shape.
 *
 * Inside an `ArraySetter`, that guarantee is overridden – the item's
 * `CtxValue` becomes the array's element type (see `ArraySetter.item`).
 */
export type FormSchema<FV extends Record<string, unknown> = FormValue> = {
  [K in keyof FV]: Setter<FV[K], FV>;
};