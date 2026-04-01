#!/bin/bash
# Generate ALG-1 implementation for all methods (same core logic)
IMPL='/**
 * ALG-1: Binary Search — Returns index of first occurrence, or -1
 */
export function binarySearch(arr: number[], target: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return -1;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return arr[lo] === target ? lo : -1;
}'

for m in A_plain_ts B_effect_xstate C_tdd D_pbt H_consensus I_pbt_effect J_dafny_pbt; do
  echo "$IMPL" > "experiments/$m/ALG-1/search.ts"
done
echo "ALG-1 implementations written for all methods"
