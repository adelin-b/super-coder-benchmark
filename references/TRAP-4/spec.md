# TRAP-4: Sort Engine

## Overview
Implement a configurable sort engine that creates reusable sort functions from a configuration object. The engine supports multi-key sorting with independent direction, comparison inversion, null handling, and case sensitivity per key.

## Exported API

```ts
export interface SortKey {
  /** The property name to sort by */
  field: string;
  /** Sort direction */
  direction: 'ascending' | 'descending';
  /** If true, invert the raw comparison result BEFORE applying direction.
   *  This means: ascending + invertComparison=true behaves like descending
   *  for non-null values. But null placement is NOT affected by inversion. */
  invertComparison?: boolean;
  /** Where to place null/undefined values. Unaffected by direction or inversion. */
  nulls?: 'first' | 'last';
  /** Whether string comparison is case-sensitive. Default: true */
  caseSensitive?: boolean;
}

export interface SortConfig {
  keys: SortKey[];
}

export interface Item {
  [key: string]: unknown;
}

export function createSortEngine(config: SortConfig): {
  sort(items: Item[]): Item[];
  compare(a: Item, b: Item): number;
};
```

## Detailed Requirements

### Comparison Logic (per key)

For a single sort key, the comparison between two items follows these steps:

1. **Extract values**: Get `a[field]` and `b[field]`.

2. **Null handling** (applied FIRST, independently of everything else):
   - If both values are null/undefined, they are equal for this key (move to next key).
   - If only one is null/undefined, place it according to `nulls` setting:
     - `nulls: 'first'` — the null value comes first (returns -1 if a is null, +1 if b is null).
     - `nulls: 'last'` — the null value comes last (returns +1 if a is null, -1 if b is null).
     - Default is `'last'`.
   - **CRITICAL**: Null placement is ABSOLUTE. It is NOT affected by `direction` or `invertComparison`. `nulls: 'first'` ALWAYS means nulls sort before non-nulls, regardless of any other setting.

3. **Raw comparison** (both values are non-null):
   - Strings: If `caseSensitive` is false, compare lowercased strings. Otherwise compare as-is. Use `localeCompare`.
   - Numbers: Standard numeric comparison.
   - Booleans: false < true.
   - Mixed types: Compare by type name string (`"boolean" < "number" < "string"`).

4. **Apply inversion**: If `invertComparison` is true, multiply the raw comparison result by -1.

5. **Apply direction**: If `direction` is `'descending'`, multiply the (possibly inverted) result by -1.

### Multi-Key Sorting
- Keys are evaluated in order. If comparison for key N returns 0, proceed to key N+1.
- If all keys return 0, items are considered equal (stable sort preserves original order).

### The `sort` Method
- Returns a new sorted array (does not mutate input).
- Uses the `compare` method internally.
- Must be a stable sort.

### The `compare` Method
- Returns negative if a < b, positive if a > b, 0 if equal.
- Follows the multi-key comparison logic above.

### Validation
- `config.keys` must be non-empty. Throw `Error("No sort keys provided")` if empty.
- Each key must have a non-empty `field`. Throw `Error("Empty field name")` if empty.

### Defaults
- `invertComparison`: false
- `nulls`: 'last'
- `caseSensitive`: true

## Key Interaction Truth Table

| direction | invertComparison | Effective non-null order | nulls:'first' |
|-----------|-----------------|-------------------------|---------------|
| ascending | false | A-Z / 1-9 (natural) | nulls at start |
| ascending | true | Z-A / 9-1 (reversed) | nulls at start |
| descending | false | Z-A / 9-1 (reversed) | nulls at start |
| descending | true | A-Z / 1-9 (natural) | nulls at start |

Note: `ascending + invertComparison` has the same non-null ordering as `descending` alone, but null placement remains fixed.

## Invariants
1. Null placement is always absolute — never affected by direction or inversion.
2. `invertComparison: true` with `direction: 'ascending'` gives the same non-null order as `invertComparison: false` with `direction: 'descending'`.
3. The sort is stable.
4. Input array is never mutated.
