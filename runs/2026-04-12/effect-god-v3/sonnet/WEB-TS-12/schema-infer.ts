import { Effect, Data } from "effect";

// ─── Type-Level Helpers ───────────────────────────────────────────────────────

type InferUnion<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? InferSchema<Head> | InferUnion<Tail>
  : never;

type InferIntersection<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? InferSchema<Head> & InferIntersection<Tail>
  : unknown;

type InferObjectRequired<P, R extends readonly string[]> = {
  [K in keyof P as K extends R[number] ? K : never]: InferSchema<P[K]>;
};

type InferObjectOptional<P, R extends readonly string[]> = {
  [K in keyof P as K extends R[number] ? never : K]?: InferSchema<P[K]>;
};

type InferObject<P, R extends readonly string[]> = InferObjectRequired<P, R> &
  InferObjectOptional<P, R>;

// ─── InferSchema<S> ──────────────────────────────────────────────────────────

export type InferSchema<S> =
  // nullable first (before type dispatch)
  S extends { nullable: true; type: infer T extends string }
    ? InferSchema<{ type: T }> | null
    : // enum
      S extends { enum: infer E extends readonly unknown[] }
      ? E[number]
      : // oneOf
        S extends { oneOf: infer U extends readonly unknown[] }
        ? InferUnion<U>
        : // allOf
          S extends { allOf: infer A extends readonly unknown[] }
          ? InferIntersection<A>
          : // primitives
            S extends { type: "string" }
            ? string
            : S extends { type: "number" | "integer" }
              ? number
              : S extends { type: "boolean" }
                ? boolean
                : S extends { type: "null" }
                  ? null
                  : // array
                    S extends { type: "array"; items: infer I }
                    ? InferSchema<I>[]
                    : // object with required
                      S extends {
                        type: "object";
                        properties: infer P;
                        required: infer R extends readonly string[];
                      }
                      ? InferObject<P, R>
                      : // object without required
                        S extends { type: "object"; properties: infer P }
                        ? { [K in keyof P]?: InferSchema<P[K]> }
                        : unknown;

// ─── Internal Runtime Validation ─────────────────────────────────────────────

class ValidationError extends Data.TaggedError("ValidationError")<{
  errors: string[];
}> {}

function runValidation(
  schema: unknown,
  data: unknown,
  path: string
): string[] {
  const s = schema as Record<string, unknown>;

  // nullable
  if (s["nullable"] === true) {
    if (data === null) return [];
    const inner: Record<string, unknown> = { ...s };
    delete inner["nullable"];
    return runValidation(inner, data, path);
  }

  // enum
  if ("enum" in s) {
    const enumValues = s["enum"] as unknown[];
    if (enumValues.includes(data)) return [];
    return [
      `${path || "value"}: expected one of [${enumValues.map((v) => JSON.stringify(v)).join(", ")}], got ${JSON.stringify(data)}`,
    ];
  }

  // oneOf
  if ("oneOf" in s) {
    const schemas = s["oneOf"] as unknown[];
    for (const sub of schemas) {
      if (runValidation(sub, data, path).length === 0) return [];
    }
    return [
      `${path || "value"}: data does not match any schema in oneOf`,
    ];
  }

  // allOf
  if ("allOf" in s) {
    const schemas = s["allOf"] as unknown[];
    const errors: string[] = [];
    for (const sub of schemas) {
      errors.push(...runValidation(sub, data, path));
    }
    return errors;
  }

  const type = s["type"] as string | undefined;

  switch (type) {
    case "string":
      if (typeof data === "string") return [];
      return [
        `${path || "value"}: expected string, got ${typeof data}`,
      ];

    case "number":
      if (typeof data === "number" && !isNaN(data)) return [];
      return [
        `${path || "value"}: expected number, got ${typeof data}`,
      ];

    case "integer":
      if (typeof data === "number" && Number.isInteger(data)) return [];
      return [
        `${path || "value"}: expected integer, got ${JSON.stringify(data)}`,
      ];

    case "boolean":
      if (typeof data === "boolean") return [];
      return [
        `${path || "value"}: expected boolean, got ${typeof data}`,
      ];

    case "null":
      if (data === null) return [];
      return [
        `${path || "value"}: expected null, got ${typeof data}`,
      ];

    case "array": {
      if (!Array.isArray(data))
        return [`${path || "value"}: expected array, got ${typeof data}`];
      const items = s["items"];
      if (!items) return [];
      const errors: string[] = [];
      for (let i = 0; i < (data as unknown[]).length; i++) {
        errors.push(
          ...runValidation(items, (data as unknown[])[i], `${path}[${i}]`)
        );
      }
      return errors;
    }

    case "object": {
      if (
        typeof data !== "object" ||
        data === null ||
        Array.isArray(data)
      ) {
        return [
          `${path || "value"}: expected object, got ${Array.isArray(data) ? "array" : typeof data}`,
        ];
      }
      const errors: string[] = [];
      const required = (s["required"] as string[] | undefined) ?? [];
      const dataObj = data as Record<string, unknown>;

      for (const key of required) {
        if (!(key in dataObj)) {
          errors.push(
            `${path ? path + "." : ""}${key}: missing required property`
          );
        }
      }

      const properties = s["properties"] as
        | Record<string, unknown>
        | undefined;
      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          if (key in dataObj) {
            errors.push(
              ...runValidation(
                propSchema,
                dataObj[key],
                `${path ? path + "." : ""}${key}`
              )
            );
          }
        }
      }
      return errors;
    }

    default:
      return [];
  }
}

// ─── createValidator ──────────────────────────────────────────────────────────

export function createValidator<S>(
  schema: S
): (data: unknown) => data is InferSchema<S> {
  return (data: unknown): data is InferSchema<S> => {
    const errors = runValidation(schema, data, "");
    return errors.length === 0;
  };
}

// ─── validate ─────────────────────────────────────────────────────────────────

export function validate<S>(
  schema: S,
  data: unknown
):
  | { success: true; data: InferSchema<S> }
  | { success: false; errors: string[] } {
  const effect: Effect.Effect<
    InferSchema<S>,
    ValidationError
  > = Effect.gen(function* () {
    const errors = runValidation(schema, data, "");
    if (errors.length > 0) {
      yield* Effect.fail(new ValidationError({ errors }));
    }
    return data as InferSchema<S>;
  });

  const exit = Effect.runSyncExit(effect);

  if (exit._tag === "Success") {
    return { success: true, data: exit.value };
  }

  // Extract errors from the cause
  const cause = exit.cause;
  if (cause._tag === "Fail" && cause.error instanceof ValidationError) {
    return { success: false, errors: cause.error.errors };
  }

  // Fallback: squash and convert
  const raw = cause._tag === "Fail" ? cause.error : cause;
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "object" && raw !== null && "errors" in raw
        ? (raw as ValidationError).errors
        : [String(raw)];
  return {
    success: false,
    errors: Array.isArray(message) ? message : [String(message)],
  };
}