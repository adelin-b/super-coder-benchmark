import { Effect, Data, Exit, Cause } from "effect";

// ─── Pre-provided types ───────────────────────────────────────────────────────

export type SetterValueType =
  | string
  | number
  | boolean
  | string[]
  | { [key: string]: SetterValueType };

export interface InputSetter {
  type: "input";
  defaultValue?: string;
  label?: string;
}

export interface NumberSetter {
  type: "number";
  defaultValue?: number;
  label?: string;
}

export interface CheckboxSetter {
  type: "checkbox";
  defaultValue?: boolean;
  label?: string;
}

export interface ArraySetter {
  type: "array";
  defaultValue?: string[];
  label?: string;
}

export interface ObjectSetter {
  type: "object";
  defaultValue?: { [key: string]: SetterValueType };
  label?: string;
}

type ToSetter<V extends SetterValueType> = V extends string
  ? InputSetter
  : V extends number
  ? NumberSetter
  : V extends boolean
  ? CheckboxSetter
  : V extends string[]
  ? ArraySetter
  : V extends { [key: string]: SetterValueType }
  ? ObjectSetter
  : never;

export type ValueSetter<T extends { [key: string]: SetterValueType }> = {
  [K in keyof T]: ToSetter<T[K]>;
};

// ─── New exported types ───────────────────────────────────────────────────────

/**
 * ExpressionEvent<SetterValue, FormValue>
 *
 * Both generic parameters are required (no defaults) — omitting either is a
 * compile-time error due to the constraints on each parameter.
 */
export interface ExpressionEvent<
  SetterValue extends SetterValueType,
  FormValue extends { [key: string]: SetterValueType }
> {
  value: SetterValue;
  formValue: FormValue;
}

/**
 * Expression<SetterValue, FormValue, ExpressionValue>
 *
 * Represents a deferred/computed field value backed by a callback that
 * receives a fully-typed ExpressionEvent context.
 */
export interface Expression<
  SetterValue extends SetterValueType,
  FormValue extends { [key: string]: SetterValueType },
  ExpressionValue
> {
  type: "expression";
  value: (ctx: ExpressionEvent<SetterValue, FormValue>) => ExpressionValue;
}

/**
 * SetterMaybeExpression<SetterValue, FormValue, ExpressionValue>
 *
 * A field value that can be either a raw ExpressionValue or an Expression
 * object that computes it from form context.
 */
export type SetterMaybeExpression<
  SetterValue extends SetterValueType,
  FormValue extends { [key: string]: SetterValueType },
  ExpressionValue
> =
  | Expression<SetterValue, FormValue, ExpressionValue>
  | ExpressionValue;

/**
 * FormSchema<T>
 *
 * Root schema for a form whose value shape is T.  The `fields` property is a
 * ValueSetter<T>, which maps every key of T to the correct setter variant
 * (e.g. string → InputSetter, number → NumberSetter, etc.).
 */
export interface FormSchema<T extends { [key: string]: SetterValueType }> {
  fields: ValueSetter<T>;
}