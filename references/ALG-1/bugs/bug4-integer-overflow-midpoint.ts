/**
 * BUG 4: integer_overflow_midpoint
 * Uses (lo + hi) / 2 instead of lo + Math.floor((hi - lo) / 2)
 * In JS this doesn't cause overflow, but doesn't floor properly for odd sums,
 * AND doesn't left-bias for first occurrence.
 */
export function binarySearch(arr: number[], target: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return -1;

  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) / 2; // BUG: not floored, produces non-integer indices
    if (arr[mid] === undefined) return -1; // band-aid for non-integer mid
    if (arr[mid] < target) {
      lo = mid + 1;
    } else if (arr[mid] > target) {
      hi = mid - 1;
    } else {
      return mid; // Also doesn't left-bias
    }
  }

  return -1;
}
