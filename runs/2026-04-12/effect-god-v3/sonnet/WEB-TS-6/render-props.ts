import { Effect, Data } from "effect";

// ─── Core value type ──────────────────────────────────────────────────────────

export type SetterValueType =
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | any[];

// ─── CustomSetterRender ───────────────────────────────────────────────────────

/**
 * Describes how a custom setter is rendered.
 *
 * V  – the value type the setter edits
 * P  – additional (user-defined) props beyond the framework-injected ones
 *
 * The `render` function receives ALL props merged together:
 *   { value: V; onChange: (v: V) => void } & P
 *
 * `props` on CustomSetter is then Omit<…, 'value' | 'onChange'> = P
 */
export interface CustomSetterRender<V = any, P extends object = object> {
  customType: string;
  render: (props: { value: V; onChange: (value: V) => void } & P) => any;
}

// ─── Setter primitives ────────────────────────────────────────────────────────

export interface ValueSetter {
  type: "input" | "select" | "checkbox" | "number" | "textarea";
  defaultValue?: SetterValueType;
}

/**
 * CustomSetter is generic over the matching CustomSetterRender definition (R).
 * The optional `props` is automatically inferred as the render-parameter type
 * minus the framework-injected `value` and `onChange` fields.
 */
export interface CustomSetter<
  R extends CustomSetterRender<any, any> = CustomSetterRender<any, any>
> {
  type: "custom";
  customType: R["customType"];
  props?: Omit<Parameters<R["render"]>[0], "value" | "onChange">;
}

export interface ArraySetter {
  type: "array";
  itemSetter: Setter;
}

export interface ObjectSetter {
  type: "object";
  properties: Record<string, Setter>;
}

// ─── Union of all setter types ────────────────────────────────────────────────

export type Setter =
  | ValueSetter
  | ArraySetter
  | ObjectSetter
  | CustomSetter<CustomSetterRender<any, any>>;

// ─── FormSchema ───────────────────────────────────────────────────────────────

export type FormSchema = Record<string, Setter>;

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Creates a typed CustomSetterRender definition.
 *
 * @example
 * const MyRender = createCustomSetterRender<string, { label: string }>(
 *   'myCustomType',
 *   ({ value, onChange, label }) => { … }
 * );
 */
export function createCustomSetterRender<V, P extends object = object>(
  customType: string,
  render: (props: { value: V; onChange: (value: V) => void } & P) => any
): CustomSetterRender<V, P> {
  return { customType, render };
}

/**
 * Creates a typed CustomSetter for a given CustomSetterRender.
 * The `props` parameter is automatically typed as Omit<render-params, 'value' | 'onChange'>.
 *
 * @example
 * const setter = createCustomSetter(MyRender, { label: 'hello' });
 */
export function createCustomSetter<R extends CustomSetterRender<any, any>>(
  renderDef: R,
  props?: Omit<Parameters<R["render"]>[0], "value" | "onChange">
): CustomSetter<R> {
  return {
    type: "custom",
    customType: renderDef.customType,
    ...(props !== undefined ? { props } : {}),
  } as CustomSetter<R>;
}

// ─── Internal Effect-based helpers (not exported in public API) ───────────────

class SchemaValidationError extends Data.TaggedError("SchemaValidationError")<{
  reason: string;
}> {}

const validateSetterInternal = (
  setter: Setter
): Effect.Effect<true, SchemaValidationError> =>
  Effect.gen(function* () {
    if (setter.type === "array") {
      yield* validateSetterInternal(setter.itemSetter);
    } else if (setter.type === "object") {
      for (const child of Object.values(setter.properties)) {
        yield* validateSetterInternal(child);
      }
    }
    return true as const;
  });

/**
 * Validates a FormSchema at runtime (structural check only).
 * Throws a plain Error on failure.
 */
export function validateFormSchema(schema: FormSchema): true {
  const program = Effect.gen(function* () {
    for (const setter of Object.values(schema)) {
      yield* validateSetterInternal(setter);
    }
    return true as const;
  });

  const exit = Effect.runSyncExit(program);
  if (exit._tag === "Failure") {
    const raw = exit.cause;
    const msg =
      "_tag" in (raw as any)
        ? ((raw as any).error?.reason ?? "Schema validation failed")
        : "Schema validation failed";
    throw new Error(msg);
  }
  return exit.value;
}