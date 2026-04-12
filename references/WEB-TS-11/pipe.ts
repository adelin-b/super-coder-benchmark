// Reference implementation for WEB-TS-11: Variadic Pipe with Type Inference

// ─── Type-level utilities ─────────────────────────────────────────────────

type AnyFn = (...args: any[]) => any;

/**
 * Checks whether any function in a tuple returns a Promise.
 */
type HasAsync<Fns extends AnyFn[]> = Fns extends [infer F extends AnyFn, ...infer Rest extends AnyFn[]]
  ? ReturnType<F> extends Promise<any>
    ? true
    : HasAsync<Rest>
  : false;

/**
 * Gets the awaited return type of a function (unwraps Promise if present).
 */
type AwaitedReturn<F extends AnyFn> = Awaited<ReturnType<F>>;

/**
 * Validates that a chain of functions is compatible:
 * each function's output (awaited) matches the next function's input.
 * Returns the original tuple if valid, or replaces bad functions with never.
 */
export type PipeValidate<Fns extends AnyFn[]> = Fns extends [infer F extends AnyFn]
  ? [F]
  : Fns extends [infer F extends AnyFn, infer G extends AnyFn, ...infer Rest extends AnyFn[]]
    ? AwaitedReturn<F> extends Parameters<G>[0]
      ? [F, ...PipeValidate<[G, ...Rest]>]
      : [F, (arg: AwaitedReturn<F>) => ReturnType<G>, ...Rest]
    : [];

/**
 * Computes the return type of a pipe chain.
 */
type LastReturn<Fns extends AnyFn[]> = Fns extends [...any[], infer Last extends AnyFn]
  ? ReturnType<Last>
  : never;

/**
 * The full return type of a pipe: if any function is async, wrap in Promise.
 */
export type PipeReturn<Fns extends AnyFn[]> = HasAsync<Fns> extends true
  ? (...args: Parameters<Fns[0]>) => Promise<Awaited<LastReturn<Fns>>>
  : (...args: Parameters<Fns[0]>) => LastReturn<Fns>;

// ─── Overloads for up to 10 functions ────────────────────────────────────

export function pipe<A, B>(
  f1: (a: A) => B
): HasAsync<[(a: A) => B]> extends true ? (a: A) => Promise<Awaited<B>> : (a: A) => B;

export function pipe<A, B, C>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C
): HasAsync<[(a: A) => B, (b: Awaited<B>) => C]> extends true
  ? (a: A) => Promise<Awaited<C>>
  : (a: A) => C;

export function pipe<A, B, C, D>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D
): HasAsync<[(a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D]> extends true
  ? (a: A) => Promise<Awaited<D>>
  : (a: A) => D;

export function pipe<A, B, C, D, E>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E
): HasAsync<[(a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D, (d: Awaited<D>) => E]> extends true
  ? (a: A) => Promise<Awaited<E>>
  : (a: A) => E;

export function pipe<A, B, C, D, E, F>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F
]> extends true
  ? (a: A) => Promise<Awaited<F>>
  : (a: A) => F;

export function pipe<A, B, C, D, E, F, G>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F,
  f6: (f: Awaited<F>) => G
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F, (f: Awaited<F>) => G
]> extends true
  ? (a: A) => Promise<Awaited<G>>
  : (a: A) => G;

export function pipe<A, B, C, D, E, F, G, H>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F,
  f6: (f: Awaited<F>) => G,
  f7: (g: Awaited<G>) => H
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F, (f: Awaited<F>) => G,
  (g: Awaited<G>) => H
]> extends true
  ? (a: A) => Promise<Awaited<H>>
  : (a: A) => H;

export function pipe<A, B, C, D, E, F, G, H, I>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F,
  f6: (f: Awaited<F>) => G,
  f7: (g: Awaited<G>) => H,
  f8: (h: Awaited<H>) => I
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F, (f: Awaited<F>) => G,
  (g: Awaited<G>) => H, (h: Awaited<H>) => I
]> extends true
  ? (a: A) => Promise<Awaited<I>>
  : (a: A) => I;

export function pipe<A, B, C, D, E, F, G, H, I, J>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F,
  f6: (f: Awaited<F>) => G,
  f7: (g: Awaited<G>) => H,
  f8: (h: Awaited<H>) => I,
  f9: (i: Awaited<I>) => J
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F, (f: Awaited<F>) => G,
  (g: Awaited<G>) => H, (h: Awaited<H>) => I, (i: Awaited<I>) => J
]> extends true
  ? (a: A) => Promise<Awaited<J>>
  : (a: A) => J;

export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
  f1: (a: A) => B,
  f2: (b: Awaited<B>) => C,
  f3: (c: Awaited<C>) => D,
  f4: (d: Awaited<D>) => E,
  f5: (e: Awaited<E>) => F,
  f6: (f: Awaited<F>) => G,
  f7: (g: Awaited<G>) => H,
  f8: (h: Awaited<H>) => I,
  f9: (i: Awaited<I>) => J,
  f10: (j: Awaited<J>) => K
): HasAsync<[
  (a: A) => B, (b: Awaited<B>) => C, (c: Awaited<C>) => D,
  (d: Awaited<D>) => E, (e: Awaited<E>) => F, (f: Awaited<F>) => G,
  (g: Awaited<G>) => H, (h: Awaited<H>) => I, (i: Awaited<I>) => J,
  (j: Awaited<J>) => K
]> extends true
  ? (a: A) => Promise<Awaited<K>>
  : (a: A) => K;

// ─── Implementation ──────────────────────────────────────────────────────

export function pipe(...fns: AnyFn[]): AnyFn {
  const hasAsync = fns.some((fn) => {
    // Detect async by running a probe -- but we can't easily do that at definition time.
    // Instead, we check at call time whether any intermediate result is a Promise.
    return false; // placeholder -- real detection happens at call time
  });

  return function piped(...args: unknown[]) {
    let result: unknown = fns[0](...args);
    let isAsync = result instanceof Promise;

    if (isAsync) {
      let chain = result as Promise<unknown>;
      for (let i = 1; i < fns.length; i++) {
        const fn = fns[i];
        chain = chain.then((val) => fn(val));
      }
      return chain;
    }

    for (let i = 1; i < fns.length; i++) {
      result = fns[i](result);
      if (result instanceof Promise) {
        // Switch to async mode mid-chain
        let chain = result;
        for (let j = i + 1; j < fns.length; j++) {
          const fn = fns[j];
          chain = chain.then((val) => fn(val));
        }
        return chain;
      }
    }

    return result;
  };
}
