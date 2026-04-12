# NIGHTMARE-3: Reactive Spreadsheet Engine with Circular Detection

## Overview
Implement a spreadsheet formula engine where cells can reference other cells, creating a dependency graph. Formulas support arithmetic, conditionals (IF), aggregation (SUM, AVG over ranges), error handling (ISERROR), and volatile functions (NOW, RAND). The critical challenge is the dynamic dependency graph: `IF(A1>0, B1, C1)` depends on B1 OR C1 depending on A1's current value, which means the dependency graph changes when values change. Naive topological sort fails because the graph must be recomputed after evaluating conditional formulas.

## Exported API

```ts
export type CellValue = number | string | boolean | CellError;

export interface CellError {
  type: 'REF' | 'CIRC' | 'DIV0' | 'VALUE' | 'NAME';
  message: string;
}

export function isCellError(v: CellValue): v is CellError;

export class SpreadsheetError extends Error {}

export function createSpreadsheet(): {
  /** Set a cell's formula. Use '=' prefix for formulas, otherwise literal value. */
  setCell(ref: string, formula: string): void;

  /** Get the computed value of a cell. Returns 0 for empty cells. */
  getCell(ref: string): CellValue;

  /** Get the raw formula string for a cell. Returns '' for empty cells. */
  getCellFormula(ref: string): string;

  /** Get cells that depend on this cell (downstream). */
  getDependents(ref: string): string[];

  /** Get cells that this cell depends on (upstream). */
  getDependencies(ref: string): string[];

  /** Detect all circular reference chains. Returns array of cycles, each cycle is an array of cell refs. */
  detectCircular(): string[][];

  /** Set multiple cells atomically. All formulas are set before any evaluation. */
  batchSet(updates: Map<string, string>): void;

  /** Get a rectangular range of values. from = top-left, to = bottom-right. */
  getRange(from: string, to: string): CellValue[][];
};
```

## Detailed Requirements

### Cell References
- Cell references use standard spreadsheet notation: column letter(s) + row number, e.g. `A1`, `B2`, `Z99`, `AA1`.
- References are case-insensitive: `a1` and `A1` refer to the same cell.
- Valid columns: A-Z, AA-AZ (up to 2 letters). Valid rows: 1-999.
- Invalid references in formulas produce a `REF` error.

### Formula Syntax
- Formulas start with `=`. Values without `=` are literals.
- Literal numbers: `42`, `3.14`, `-7`. Literal strings: `"hello"`. Literal booleans: `TRUE`, `FALSE`.
- **Arithmetic**: `+`, `-`, `*`, `/` with standard precedence. Parentheses for grouping.
- **Comparison**: `>`, `<`, `>=`, `<=`, `=` (equality in formula context), `<>` (not equal). Return boolean.
- **Cell references**: `A1`, `B2`, etc. Evaluate to the cell's current value.
- **Functions**: `SUM(range)`, `AVG(range)`, `IF(cond, then, else)`, `ISERROR(value)`, `NOW()`, `RAND()`, `MIN(range)`, `MAX(range)`, `COUNT(range)`.
- **Range references**: `A1:A5` refers to a contiguous range. Only valid inside aggregate functions.

### Evaluation Rules

#### Dependency Tracking
- When a cell's formula references another cell, a dependency edge is created.
- When cell A changes, all cells that depend on A (directly or transitively) must be re-evaluated.
- Evaluation order follows topological sort of the dependency graph.

#### Dynamic Dependencies (The Core Trap)
- `IF(A1>0, B1, C1)`: the cell depends on A1 always, but depends on B1 only when A1>0, and on C1 only when A1<=0.
- When A1's value changes from positive to negative, the dependency graph changes.
- **Critical**: after evaluating an IF formula, the dependency graph must be updated. This may change the topological order for subsequent evaluations in the same update cycle.
- A correct implementation evaluates in passes: evaluate what we can, update dependencies, re-sort, repeat until stable.

#### Circular Reference Detection
- `A1 = A1 + 1` is circular (self-reference).
- `A1 = B1`, `B1 = A1` is circular.
- Circular references produce a `CIRC` error for all cells in the cycle.
- `detectCircular()` returns all cycles found.
- A cell with a `CIRC` error does not propagate the error to non-cycle dependents via `ISERROR`.

#### Error Propagation
- If A1 has an error, `B1 = A1 + 1` also has an error (same type as A1's error).
- `ISERROR(A1)` returns `true` if A1 has any error, `false` otherwise. ISERROR itself never errors.
- `IF(ISERROR(A1), 0, A1)` returns 0 if A1 has an error. This cell does NOT have an error.
- Arithmetic on errors propagates: `error + 5` = error.
- Division by zero produces a `DIV0` error.
- Using a string in arithmetic produces a `VALUE` error.
- Referencing an unknown function produces a `NAME` error.

#### Volatile Functions
- `NOW()` returns the current timestamp as a number (milliseconds since epoch).
- `RAND()` returns a random number between 0 and 1.
- Volatile cells are re-evaluated on every `getCell()` call, not cached.
- Cells that depend on volatile cells are also considered volatile.

#### Aggregate Functions
- `SUM(A1:A5)`: sum of all numeric values in range. Ignores strings and booleans. Errors propagate.
- `AVG(A1:A5)`: average of numeric values. Empty cells and non-numeric values are excluded from count. If no numeric values, returns `DIV0` error.
- `MIN(A1:A5)`: minimum numeric value. If no numeric values, returns 0.
- `MAX(A1:A5)`: maximum numeric value. If no numeric values, returns 0.
- `COUNT(A1:A5)`: count of cells with numeric values.
- If any cell in the range has an error, the aggregate returns that error.

#### Precision
- All arithmetic uses standard JavaScript floating-point.
- Currency-style rounding is NOT applied automatically. Values are stored as-is.

### Batch Updates
- `batchSet(updates)` sets all formulas first, then re-evaluates all affected cells.
- This is important for resolving mutual dependencies that would be circular if set one-by-one.
- Example: setting `A1 = B1 + 1` and `B1 = 5` in one batch is valid; setting A1 first alone would reference an empty B1.

### getRange
- `getRange("A1", "C3")` returns a 3x3 array of values.
- The first index is row (top to bottom), second is column (left to right).

### Validation
- `setCell` with invalid ref format throws `SpreadsheetError`.
- `getCell` with invalid ref format throws `SpreadsheetError`.
- `getRange` with invalid refs throws `SpreadsheetError`.
- `getRange` where `from` is below/right of `to` throws `SpreadsheetError`.

## Invariants
1. A cell with no formula returns 0 (number) from `getCell`.
2. `getDependents(X)` returns cells whose current formula references X.
3. `getDependencies(X)` returns cells that X's current formula references.
4. Circular references are always detected and produce `CIRC` errors.
5. `ISERROR` never produces an error itself.
6. Volatile cells are never cached — they re-evaluate every time.
7. After `batchSet`, all affected cells reflect the new state consistently.
8. Dynamic IF dependencies are tracked per the current condition value.
