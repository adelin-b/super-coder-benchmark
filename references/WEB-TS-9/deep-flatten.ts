// Reference implementation for WEB-TS-9: Deep Recursive Type Flattening

/**
 * Determines if a type is a plain object that should be recursed into.
 * Arrays, Dates, RegExps, Maps, Sets, Functions, and other built-ins are leaves.
 */
type IsPlainObject<T> = T extends readonly any[]
  ? false
  : T extends Function
    ? false
    : T extends Date
      ? false
      : T extends RegExp
        ? false
        : T extends Map<any, any>
          ? false
          : T extends Set<any>
            ? false
            : T extends object
              ? true
              : false;

/**
 * Internal helper: flattens with prefix accumulation.
 * For each key K in T:
 *   - If T[K] is a plain object, recurse with prefix `${Prefix}${K}.`
 *   - Otherwise, emit `${Prefix}${K}: T[K]`
 */
type FlattenWithPrefix<T, Prefix extends string = ""> = T extends object
  ? IsPlainObject<T> extends true
    ? {
        [K in keyof T & string as IsPlainObject<T[K]> extends true
          ? keyof FlattenWithPrefix<T[K], `${Prefix}${K}.`> & string
          : `${Prefix}${K}`]: IsPlainObject<T[K]> extends true
          ? FlattenWithPrefix<T[K], `${Prefix}${K}.`>[keyof FlattenWithPrefix<
              T[K],
              `${Prefix}${K}.`
            > &
              string]
          : T[K];
      }
    : never
  : never;

/**
 * Recursively flattens a nested object type into dot-notation keys.
 */
export type DeepFlatten<T> = FlattenWithPrefix<T>;

/**
 * Split a dot-notation string into head and tail.
 */
type SplitFirst<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? [Head, Tail]
  : [S, never];

/**
 * Groups flat keys by their first segment, building a nested structure.
 */
type GroupByPrefix<T> = {
  [K in keyof T & string as SplitFirst<K>[0]]: SplitFirst<K>[1] extends never
    ? T[K]
    : GroupByPrefix<{
        [P in keyof T & string as P extends `${SplitFirst<K>[0]}.${infer Rest}`
          ? Rest
          : never]: T[P];
      }>;
};

/**
 * Reverses DeepFlatten: given a flat object with dot-notation keys,
 * reconstructs the original nested object type.
 */
export type DeepUnflatten<T> = GroupByPrefix<T>;

// ─── Runtime ────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  if (value instanceof RegExp) return false;
  if (value instanceof Map) return false;
  if (value instanceof Set) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Runtime: flattens a nested object into dot-notation keys.
 */
export function deepFlatten<T extends Record<string, unknown>>(
  obj: T
): DeepFlatten<T> {
  const result: Record<string, unknown> = {};

  function recurse(current: Record<string, unknown>, prefix: string): void {
    for (const key of Object.keys(current)) {
      const value = current[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(value) && Object.keys(value).length > 0) {
        recurse(value as Record<string, unknown>, newKey);
      } else {
        result[newKey] = value;
      }
    }
  }

  recurse(obj, "");
  return result as DeepFlatten<T>;
}

/**
 * Runtime: unflattens a dot-notation object back into nested structure.
 */
export function deepUnflatten<T extends Record<string, unknown>>(
  obj: T
): DeepUnflatten<T> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || !isPlainObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = obj[key];
  }

  return result as DeepUnflatten<T>;
}
