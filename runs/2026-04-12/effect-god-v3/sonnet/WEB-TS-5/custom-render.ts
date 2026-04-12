// Pre-provided: React FC type alias
export type FC<P = {}> = (props: P) => any;

// Pre-provided: SetterValueType
export type SetterValueType =
  | string
  | number
  | boolean
  | object
  | null
  | undefined;

// Pre-provided: Expression
export type Expression<T> = { __isExpression: true; expression: string } | T;

// Pre-provided: FormValue
export type FormValue<T> = T | Expression<T>;

// Pre-provided: ValueSetter
export interface ValueSetter<ValueType> {
  type: "value";
  value?: FormValue<ValueType>;
}

// ─── CustomSetterRender ───────────────────────────────────────────────────────

/**
 * Describes how a custom setter renders itself.
 * `render` is an FC whose props = Props & { value, onChange }.
 */
export type CustomSetterRender<ValueType, Props = {}> = {
  render: FC<
    Props & {
      value: ValueType;
      onChange: (value: ValueType) => void;
    }
  >;
};

// ─── CustomSetter ─────────────────────────────────────────────────────────────

/**
 * A setter whose type is 'custom'. The `customType` field is constrained to
 * the keys present in `CustomSetterRenderDef`, making invalid keys a
 * compile-time error.
 */
export interface CustomSetter<
  ValueType,
  AdditionalProps,
  CustomSetterRenderDef,
  CustomType extends keyof CustomSetterRenderDef = keyof CustomSetterRenderDef
> {
  type: "custom";
  customType: CustomType;
  value?: ValueType;
}

// ─── ObjectSetter (recursive) ─────────────────────────────────────────────────

/**
 * A setter that nests a sub-schema over a structured object value.
 * Threads `CustomSetterRenderDef` through so nested custom setters are
 * equally constrained.
 */
export interface ObjectSetter<ValueType, CustomSetterRenderDef = {}> {
  type: "object";
  fields?: {
    [K in keyof ValueType]?: AnySetter<ValueType[K], CustomSetterRenderDef>;
  };
}

// ─── AnySetter union ──────────────────────────────────────────────────────────

export type AnySetter<ValueType, CustomSetterRenderDef = {}> =
  | ValueSetter<ValueType>
  | CustomSetter<ValueType, unknown, CustomSetterRenderDef>
  | ObjectSetter<ValueType, CustomSetterRenderDef>;

// ─── FormSchema ───────────────────────────────────────────────────────────────

/**
 * Top-level form schema.
 *
 * @typeParam T                    Shape of the form's data model.
 * @typeParam CustomSetterRenderDef  Map of custom-type names → CustomSetterRender
 *                                   instances.  Defaults to `{}` (no custom setters).
 *
 * `customSetterRenderDefinitions` must satisfy the exact shape of
 * `CustomSetterRenderDef`.  Any `CustomSetter` nested inside the schema's
 * `fields` (including recursively inside `ObjectSetter`) has its `customType`
 * constrained to `keyof CustomSetterRenderDef`.
 */
export interface FormSchema<T, CustomSetterRenderDef = {}> {
  /** Registry that maps each custom-type name to its render definition. */
  customSetterRenderDefinitions?: CustomSetterRenderDef;

  /** Field-level setter definitions, threaded with the render-def constraint. */
  fields?: {
    [K in keyof T]?: AnySetter<T[K], CustomSetterRenderDef>;
  };
}