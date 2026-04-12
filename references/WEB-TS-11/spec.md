# WEB-TS-11: Variadic Pipe with Type Inference

## Overview
Implement a type-safe `pipe` function where each function's output type feeds into the next function's input type. The return type is inferred from the entire chain. The pipe must handle sync functions, async functions, and mixed sync/async chains.

## What You Must Implement

In the file `pipe.ts`, implement and export:

### 1. `Pipe` type
A variadic function type that accepts 1-10 functions where:
- The first function can take any input.
- Each subsequent function's input must match the previous function's output (awaited if async).
- The return type is the output of the last function (wrapped in Promise if any function is async).

### 2. `pipe(...fns): PipeReturn`
A runtime function that:
- Accepts 1 to 10 functions.
- Chains them so each function's output is passed as input to the next.
- Returns a new function with the correct input/output types.
- If ANY function in the chain returns a Promise, the entire pipe returns a Promise (auto-awaits intermediate results).
- Handles errors: if any function throws, the error propagates.

### 3. `PipeReturn<Fns>`
A type that, given a tuple of function types, computes:
- The input type (parameters of the first function).
- The output type (return of the last function, Promise-wrapped if any fn is async).

### 4. `PipeValidate<Fns>`
A type that validates a tuple of functions forms a valid pipe chain. If function N's output doesn't match function N+1's input, the type resolves to `never`.

## Key Constraints
- Type inference must work WITHOUT explicit generic annotations -- `pipe(f1, f2, f3)` must infer all types.
- Async detection must be automatic: if `f2` returns `Promise<string>`, then `f3` must accept `string` (the awaited type).
- The returned function must be async if ANY function in the chain is async.
- Must support 1-function pipes (identity-like).
- Must support up to 10 functions in the chain.
- Type errors must appear at the call site when functions are incompatible (e.g., piping `() => number` into `(s: string) => void`).
