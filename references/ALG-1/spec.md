# ALG-1: Sorted Search with Edge Cases

## Spec

Binary search on a sorted array. Return index if found, -1 if not.
Handle: empty array, single element, duplicates (return first occurrence).

## Interface

```typescript
function binarySearch(arr: number[], target: number): number;
```

## Constraints

- Input array is sorted in ascending order
- If target appears multiple times, return index of FIRST occurrence
- Empty array → return -1
- Single element → correct handling

## Invariants

1. If returns >= 0 then `arr[result] === target`
2. If returns -1 then target not in array
3. If duplicates exist, returned index is the FIRST occurrence (no smaller valid index)
4. Result is always in range [-1, arr.length - 1]

## Known Bugs to Seed

1. **off_by_one_bounds**: Use `lo <= hi` with `hi = arr.length` instead of `arr.length - 1` → out-of-bounds access
2. **infinite_loop_single**: When `lo === hi` and `arr[lo] !== target`, fail to narrow → infinite loop (use `lo < hi` without handling `lo === hi` case)
3. **wrong_index_duplicates**: Return any matching index (not first) — use standard binary search without left-biasing
4. **integer_overflow_midpoint**: Use `(lo + hi) / 2` instead of `lo + Math.floor((hi - lo) / 2)` — overflow for large arrays (not easily triggerable in JS, but pattern is wrong)
