// Reference implementation for WEB-TS-12: JSON Schema to TypeScript Type

// ─── Type-level inference ────────────────────────────────────────────────

/**
 * Helper: given a properties record P and required tuple R,
 * produce an object type with required keys mandatory and rest optional.
 */
type BuildObject<
  P extends Record<string, unknown>,
  R extends readonly string[],
> = {
  [K in keyof P as K extends R[number] ? K : never]: InferSchema<P[K]>;
} & {
  [K in keyof P as K extends R[number] ? never : K]?: InferSchema<P[K]>;
};

/**
 * Simplify an intersection into a single flat object.
 */
type Simplify<T> = { [K in keyof T]: T[K] };

/**
 * Infer union from oneOf array.
 */
type InferOneOf<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? InferSchema<Head> | InferOneOf<Tail>
  : never;

/**
 * Infer intersection from allOf array.
 */
type InferAllOf<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? InferSchema<Head> & InferAllOf<Tail>
  : unknown;

/**
 * Convert a readonly tuple of values to a union of their literal types.
 */
type TupleToUnion<T extends readonly unknown[]> = T[number];

/**
 * Main type: given a JSON Schema const object, infer the TypeScript type.
 */
export type InferSchema<S> =
  // Handle nullable wrapper
  S extends { readonly nullable: true }
    ? InferSchemaCore<Omit<S, "nullable">> | null
    : InferSchemaCore<S>;

type InferSchemaCore<S> =
  // enum
  S extends { readonly enum: readonly (infer E)[] }
    ? E
    : // oneOf
      S extends { readonly oneOf: readonly [...infer Schemas] }
      ? InferOneOf<Schemas>
      : // allOf
        S extends { readonly allOf: readonly [...infer Schemas] }
        ? Simplify<InferAllOf<Schemas>>
        : // string
          S extends { readonly type: "string" }
          ? string
          : // number / integer
            S extends { readonly type: "number" | "integer" }
            ? number
            : // boolean
              S extends { readonly type: "boolean" }
              ? boolean
              : // null
                S extends { readonly type: "null" }
                ? null
                : // array
                  S extends { readonly type: "array"; readonly items: infer Items }
                  ? InferSchema<Items>[]
                  : // object with required
                    S extends {
                        readonly type: "object";
                        readonly properties: infer P extends Record<string, unknown>;
                        readonly required: infer R extends readonly string[];
                      }
                    ? Simplify<BuildObject<P, R>>
                    : // object without required (all optional)
                      S extends {
                          readonly type: "object";
                          readonly properties: infer P extends Record<string, unknown>;
                        }
                      ? Simplify<{ [K in keyof P]?: InferSchema<P[K]> }>
                      : unknown;

// ─── Runtime validator ───────────────────────────────────────────────────

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationFailure {
  success: false;
  errors: string[];
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function validateValue(schema: any, data: unknown, path: string): string[] {
  const errors: string[] = [];

  // Handle nullable
  if (schema.nullable === true && data === null) {
    return [];
  }

  // Handle enum
  if (schema.enum) {
    if (!schema.enum.includes(data)) {
      errors.push(`${path}: value must be one of [${schema.enum.join(", ")}]`);
    }
    return errors;
  }

  // Handle oneOf
  if (schema.oneOf) {
    const anyMatch = schema.oneOf.some(
      (s: any) => validateValue(s, data, path).length === 0
    );
    if (!anyMatch) {
      errors.push(`${path}: value does not match any oneOf schema`);
    }
    return errors;
  }

  // Handle allOf
  if (schema.allOf) {
    for (const sub of schema.allOf) {
      errors.push(...validateValue(sub, data, path));
    }
    return errors;
  }

  // Handle type-based validation
  switch (schema.type) {
    case "string":
      if (typeof data !== "string") {
        errors.push(`${path}: expected string, got ${typeof data}`);
      }
      break;
    case "number":
    case "integer":
      if (typeof data !== "number") {
        errors.push(`${path}: expected number, got ${typeof data}`);
      }
      if (schema.type === "integer" && typeof data === "number" && !Number.isInteger(data)) {
        errors.push(`${path}: expected integer, got float`);
      }
      break;
    case "boolean":
      if (typeof data !== "boolean") {
        errors.push(`${path}: expected boolean, got ${typeof data}`);
      }
      break;
    case "null":
      if (data !== null) {
        errors.push(`${path}: expected null, got ${typeof data}`);
      }
      break;
    case "array":
      if (!Array.isArray(data)) {
        errors.push(`${path}: expected array, got ${typeof data}`);
      } else if (schema.items) {
        data.forEach((item: unknown, i: number) => {
          errors.push(...validateValue(schema.items, item, `${path}[${i}]`));
        });
      }
      break;
    case "object":
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        errors.push(`${path}: expected object, got ${typeof data}`);
      } else {
        const obj = data as Record<string, unknown>;
        const required: string[] = schema.required || [];
        const properties = schema.properties || {};

        for (const key of required) {
          if (!(key in obj)) {
            errors.push(`${path}.${key}: required property missing`);
          }
        }

        for (const [key, propSchema] of Object.entries(properties)) {
          if (key in obj) {
            errors.push(
              ...validateValue(propSchema, obj[key], `${path}.${key}`)
            );
          }
        }
      }
      break;
  }

  return errors;
}

/**
 * Creates a type guard validator from a JSON Schema.
 */
export function createValidator<const S>(
  schema: S
): (data: unknown) => data is InferSchema<S> {
  return (data: unknown): data is InferSchema<S> => {
    const errors = validateValue(schema, data, "$");
    return errors.length === 0;
  };
}

/**
 * Validates data against a JSON Schema and returns typed results.
 */
export function validate<const S>(
  schema: S,
  data: unknown
): ValidationResult<InferSchema<S>> {
  const errors = validateValue(schema, data, "$");
  if (errors.length === 0) {
    return { success: true, data: data as InferSchema<S> };
  }
  return { success: false, errors };
}
