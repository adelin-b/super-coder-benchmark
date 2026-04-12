# TRAP-1: Remove Duplicates

## Overview
Implement a function that removes duplicate entries from an array of objects based on their `id` field.

## Exported API

```ts
export interface Item {
  id: string;
  value: number;
  timestamp: number;
}

export function removeDuplicates(items: Item[]): Item[];
```

## Detailed Requirements

### Duplicate Resolution
- Items are considered duplicates when they share the same `id`.
- When items share the same `id`, keep the one with the **highest** `timestamp`.
- If timestamps are equal, keep the one with the **lowest** `value`.
- If both timestamp and value are equal, keep the first occurrence in the original array.

### Output Ordering
- Return results sorted by `id` in ascending lexicographic order.

### Edge Cases
- An empty array returns an empty array.
- An array with no duplicates returns all items, sorted by `id`.
- Items with the same `id`, same `timestamp`, and same `value` — keep first occurrence, sorted by `id`.
- The input array must not be mutated.

### Validation
- All items must have a non-empty string `id`. If any item has an empty `id`, throw an `Error` with message `"Invalid item: empty id"`.
- `value` and `timestamp` must be finite numbers. If not, throw an `Error` with message `"Invalid item: non-finite number"`.

## Invariants
1. The output length is always <= the input length.
2. Every `id` in the output appears exactly once.
3. The output is sorted by `id` ascending.
4. For each `id` group, the kept item has the highest timestamp (tie-broken by lowest value).
