# EXERCISM-1: Forth Interpreter

## Overview
Implement an evaluator for a very simple subset of Forth.

Forth is a stack-based programming language. Implement a very basic evaluator for a small subset of Forth.

Your evaluator has to support the following words:

- `+`, `-`, `*`, `/` (integer arithmetic)
- `DUP`, `DROP`, `SWAP`, `OVER` (stack manipulation)

Your evaluator also has to support defining new words using the customary syntax: `: word-name definition ;`.

To keep things simple the only data type you need to support is signed integers of at least 16 bits size.

You should use the following rules for the syntax: a number is a sequence of one or more (ASCII) digits, a word is a sequence of one or more letters, digits, symbols or punctuation that is not a number. (Forth probably uses slightly different rules, but this is close enough.)

Words are case-insensitive.

## Exported API

```ts
export class Forth {
  stack: number[];
  evaluate(program: string): void;
}
```

## Rules

### Arithmetic
- `+` pops two values, pushes their sum
- `-` pops two values, pushes (second - top)
- `*` pops two values, pushes their product
- `/` pops two values, pushes integer division (second / top), rounding toward zero
- Division by zero throws `Error('Division by zero')`

### Stack Manipulation
- `DUP` duplicates the top value
- `DROP` removes the top value
- `SWAP` swaps the top two values
- `OVER` copies the second-from-top value to the top

### Error Handling
- Operating on an empty stack throws `Error('Stack empty')`
- Operating with only one value when two are needed throws `Error('Only one value on the stack')`
- Executing an undefined word throws `Error('Unknown command')`
- Attempting to redefine a number throws `Error('Invalid definition')`

### User-defined Words
- Words are defined with `: word-name definition ;`
- Definitions can use built-in words and other user-defined words
- Words can be redefined, overriding previous definitions
- Words can override built-in words and operators
- User-defined words are case-insensitive
- Definitions are scoped to the Forth instance (not global)
- When a word is redefined, previously defined words that used the old definition retain the old behavior
