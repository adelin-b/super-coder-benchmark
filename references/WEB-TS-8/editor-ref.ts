// Reference implementation for WEB-TS-8: Type-Safe Nested Path Access
// Adapted from Web-Bench TypeScript project task 20 (Apache 2.0)

export type SetterValueType =
  | string
  | number
  | boolean
  | SetterValueType[]
  | { [key: string]: SetterValueType }

// Recursively resolve the value type at a given path
type PathValue<T, P extends (string | number | symbol)[]> = P extends [
  infer First,
  ...infer Rest,
]
  ? First extends keyof T
    ? Rest extends []
      ? T[First]
      : Rest extends (string | number | symbol)[]
        ? PathValue<T[First], Rest>
        : never
    : never
  : never

// Valid paths into object T (supports 1 and 2 levels)
type ValidPaths<T> = {
  [K in keyof T]: [K] | (T[K] extends { [key: string]: any }
    ? { [K2 in keyof T[K]]: [K, K2] }[keyof T[K]]
    : never)
}[keyof T]

export interface EditorRef<
  T extends { [key: string]: SetterValueType } = { [key: string]: SetterValueType },
> {
  setSetterValueByPath<P extends ValidPaths<T> & (string | number | symbol)[]>(
    path: P,
    value: PathValue<T, P>,
  ): void
}
