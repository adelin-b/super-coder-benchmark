// ─── Utility Types ────────────────────────────────────────────────────────────

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends
  (x: infer I) => void
  ? I
  : never;

// ─── IsPlainObject ────────────────────────────────────────────────────────────

type IsPlainObject<T> = [T] extends [object]
  ? [T] extends [Array<any>]
    ? false
    : [T] extends [Date]
    ? false
    : [T] extends [RegExp]
    ? false
    : [T] extends [Map<any, any>]
    ? false
    : [T] extends [Set<any>]
    ? false
    : [T] extends [Function]
    ? false
    : true
  : false;

// ─── DeepFlatten ──────────────────────────────────────────────────────────────

export type DeepFlatten<T> = IsPlainObject<T> extends true
  ? [keyof T & string] extends [never]
    ? {}
    : UnionToIntersection<
        {
          [K in keyof T & string]: IsPlainObject<T[K]> extends true
            ? [keyof T[K]] extends [never]
              ? { [P in K]: T[K] }
              : {
                  [SubK in keyof DeepFlatten<T[K]> &
                    string as `${K}.${SubK}`]: DeepFlatten<T[K]>[SubK];
                }
            : { [P in K]: T[K] };
        }[keyof T & string]
      >
  : T;

// ─── DeepUnflatten ────────────────────────────────────────────────────────────

type SplitDot<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? [Head, ...SplitDot<Tail>]
  : [S];

type SetNestedPath<Keys extends string[], Value> = Keys extends [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? Tail extends []
    ? { [K in Head]: Value }
    : { [K in Head]: SetNestedPath<Tail, Value> }
  : never;

export type DeepUnflatten<T> = [keyof T & string] extends [never]
  ? {}
  : UnionToIntersection<
      {
        [K in keyof T & string]: SetNestedPath<SplitDot<K>, T[K]>;
      }[keyof T & string]
    >;

// ─── Runtime Helper ───────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || val === undefined) return false;
  if (typeof val !== "object") return false;
  if (Array.isArray(val)) return false;
  if (val instanceof Date) return false;
  if (val instanceof RegExp) return false;
  if (val instanceof Map) return false;
  if (val instanceof Set) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

// ─── deepFlatten ──────────────────────────────────────────────────────────────

export function deepFlatten<T>(obj: T): DeepFlatten<T> {
  const result: Record<string, unknown> = {};

  function flatten(current: unknown, prefix: string): void {
    if (isPlainObject(current)) {
      const keys = Object.keys(current);
      if (keys.length === 0) {
        // Empty object is a leaf — preserve as-is
        result[prefix] = current;
      } else {
        for (const key of keys) {
          flatten(current[key], prefix ? `${prefix}.${key}` : key);
        }
      }
    } else {
      result[prefix] = current;
    }
  }

  if (isPlainObject(obj)) {
    for (const key of Object.keys(obj)) {
      flatten(obj[key], key);
    }
  }

  return result as DeepFlatten<T>;
}

// ─── deepUnflatten ────────────────────────────────────────────────────────────

export function deepUnflatten<T>(obj: T): DeepUnflatten<T> {
  const result: Record<string, unknown> = {};

  if (!isPlainObject(obj as unknown)) return result as DeepUnflatten<T>;

  for (const flatKey of Object.keys(obj as Record<string, unknown>)) {
    const parts = flatKey.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!isPlainObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = (obj as Record<string, unknown>)[
      flatKey
    ];
  }

  return result as DeepUnflatten<T>;
}