// ─── Internal Helpers ────────────────────────────────────────────────────────

type AnyFn = (...args: any[]) => any;

/** Recursively check whether any function in the tuple returns a Promise. */
type HasAsync<Fns extends readonly AnyFn[]> =
  Fns extends readonly []
    ? false
    : Fns extends readonly [infer F extends AnyFn, ...infer Rest extends AnyFn[]]
    ? ReturnType<F> extends Promise<any>
      ? true
      : HasAsync<Rest>
    : false;

/** Extract the last function in a tuple. */
type LastFn<Fns extends readonly AnyFn[]> =
  Fns extends readonly [...any[], infer Last extends AnyFn] ? Last : never;

// ─── Exported Types ───────────────────────────────────────────────────────────

/**
 * Given a tuple of function types, computes the type of the resulting piped
 * function:
 *  - Parameters come from the first function.
 *  - Return type comes from the last function.
 *  - If any function is async the return type is wrapped in Promise.
 */
export type PipeReturn<Fns extends readonly AnyFn[]> =
  Fns extends readonly [infer First extends AnyFn, ...any[]]
    ? HasAsync<Fns> extends true
      ? (...args: Parameters<First>) => Promise<Awaited<ReturnType<LastFn<Fns>>>>
      : (...args: Parameters<First>) => ReturnType<LastFn<Fns>>
    : never;

/**
 * Validates that every adjacent pair in the function tuple is compatible
 * (i.e. the awaited output of fn[N] is assignable to the input of fn[N+1]).
 * Resolves to `never` on any mismatch, otherwise resolves to `Fns`.
 */
export type PipeValidate<Fns extends readonly AnyFn[]> =
  Fns extends readonly [infer _Only extends AnyFn]
    ? Fns
    : Fns extends readonly [
        infer F1 extends AnyFn,
        infer F2 extends AnyFn,
        ...infer Rest extends AnyFn[]
      ]
    ? [Awaited<ReturnType<F1>>] extends [Parameters<F2>[0]]
      ? Rest extends AnyFn[]
        ? PipeValidate<[F2, ...Rest]> extends never
          ? never
          : Fns
        : never
      : never
    : never;

/**
 * The call-signature type of the `pipe` function (1–10 functions).
 */
export interface Pipe {
  <A extends AnyFn>(f1: A): PipeReturn<[A]>;
  <A extends AnyFn, B extends (arg: Awaited<ReturnType<A>>) => any>(
    f1: A, f2: B
  ): PipeReturn<[A, B]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any
  >(f1: A, f2: B, f3: C): PipeReturn<[A, B, C]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any
  >(f1: A, f2: B, f3: C, f4: D): PipeReturn<[A, B, C, D]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E): PipeReturn<[A, B, C, D, E]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any,
    F extends (arg: Awaited<ReturnType<E>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F): PipeReturn<[A, B, C, D, E, F]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any,
    F extends (arg: Awaited<ReturnType<E>>) => any,
    G extends (arg: Awaited<ReturnType<F>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G): PipeReturn<[A, B, C, D, E, F, G]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any,
    F extends (arg: Awaited<ReturnType<E>>) => any,
    G extends (arg: Awaited<ReturnType<F>>) => any,
    H extends (arg: Awaited<ReturnType<G>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H): PipeReturn<[A, B, C, D, E, F, G, H]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any,
    F extends (arg: Awaited<ReturnType<E>>) => any,
    G extends (arg: Awaited<ReturnType<F>>) => any,
    H extends (arg: Awaited<ReturnType<G>>) => any,
    I extends (arg: Awaited<ReturnType<H>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H, f9: I): PipeReturn<[A, B, C, D, E, F, G, H, I]>;
  <
    A extends AnyFn,
    B extends (arg: Awaited<ReturnType<A>>) => any,
    C extends (arg: Awaited<ReturnType<B>>) => any,
    D extends (arg: Awaited<ReturnType<C>>) => any,
    E extends (arg: Awaited<ReturnType<D>>) => any,
    F extends (arg: Awaited<ReturnType<E>>) => any,
    G extends (arg: Awaited<ReturnType<F>>) => any,
    H extends (arg: Awaited<ReturnType<G>>) => any,
    I extends (arg: Awaited<ReturnType<H>>) => any,
    J extends (arg: Awaited<ReturnType<I>>) => any
  >(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H, f9: I, f10: J): PipeReturn<[A, B, C, D, E, F, G, H, I, J]>;
}

// ─── Runtime Implementation ───────────────────────────────────────────────────

export function pipe<A extends AnyFn>(f1: A): PipeReturn<[A]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any
>(f1: A, f2: B): PipeReturn<[A, B]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any
>(f1: A, f2: B, f3: C): PipeReturn<[A, B, C]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any
>(f1: A, f2: B, f3: C, f4: D): PipeReturn<[A, B, C, D]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E): PipeReturn<[A, B, C, D, E]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any,
  F extends (arg: Awaited<ReturnType<E>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F): PipeReturn<[A, B, C, D, E, F]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any,
  F extends (arg: Awaited<ReturnType<E>>) => any,
  G extends (arg: Awaited<ReturnType<F>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G): PipeReturn<[A, B, C, D, E, F, G]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any,
  F extends (arg: Awaited<ReturnType<E>>) => any,
  G extends (arg: Awaited<ReturnType<F>>) => any,
  H extends (arg: Awaited<ReturnType<G>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H): PipeReturn<[A, B, C, D, E, F, G, H]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any,
  F extends (arg: Awaited<ReturnType<E>>) => any,
  G extends (arg: Awaited<ReturnType<F>>) => any,
  H extends (arg: Awaited<ReturnType<G>>) => any,
  I extends (arg: Awaited<ReturnType<H>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H, f9: I): PipeReturn<[A, B, C, D, E, F, G, H, I]>;
export function pipe<
  A extends AnyFn,
  B extends (arg: Awaited<ReturnType<A>>) => any,
  C extends (arg: Awaited<ReturnType<B>>) => any,
  D extends (arg: Awaited<ReturnType<C>>) => any,
  E extends (arg: Awaited<ReturnType<D>>) => any,
  F extends (arg: Awaited<ReturnType<E>>) => any,
  G extends (arg: Awaited<ReturnType<F>>) => any,
  H extends (arg: Awaited<ReturnType<G>>) => any,
  I extends (arg: Awaited<ReturnType<H>>) => any,
  J extends (arg: Awaited<ReturnType<I>>) => any
>(f1: A, f2: B, f3: C, f4: D, f5: E, f6: F, f7: G, f8: H, f9: I, f10: J): PipeReturn<[A, B, C, D, E, F, G, H, I, J]>;
export function pipe(...fns: AnyFn[]): AnyFn {
  if (fns.length === 0) {
    throw new Error("pipe requires at least one function");
  }
  return function (this: unknown, ...args: any[]): any {
    // Execute the first function with the original arguments.
    let result: any = fns[0](...args);

    // Thread results through remaining functions.
    // Once a step produces a Promise, all subsequent steps run inside .then()
    // so that intermediate async values are automatically awaited.
    for (let i = 1; i < fns.length; i++) {
      const fn = fns[i];
      if (result instanceof Promise) {
        result = result.then(fn);
      } else {
        result = fn(result);
      }
    }

    return result;
  };
}