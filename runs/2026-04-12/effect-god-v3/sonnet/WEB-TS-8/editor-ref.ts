export type SetterValueType =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SetterValueType }

// Depth limiter to prevent infinite recursion
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8]

// All valid tuple paths into T (single and multi-level)
type ValidPaths<T, D extends number = 7> =
  [D] extends [never]
    ? never
    : T extends { [key: string]: SetterValueType }
      ? {
          [K in keyof T & string]:
            | [K]
            | [K, ...ValidPaths<T[K], Prev[D]>]
        }[keyof T & string]
      : never

// Resolve the value type at the end of a path tuple
type PathValue<T, P extends any[]> =
  P extends [infer Head, ...infer Tail]
    ? Head extends keyof T
      ? Tail extends []
        ? T[Head]
        : PathValue<T[Head], Tail>
      : never
    : never

export interface EditorRef<T extends { [key: string]: SetterValueType }> {
  setSetterValueByPath<P extends ValidPaths<T>>(
    path: P,
    value: PathValue<T, P>
  ): void
}