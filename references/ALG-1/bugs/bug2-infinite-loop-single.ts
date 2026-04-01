/**
 * BUG 2: infinite_loop_single
 * Uses lo < hi exclusively — when lo === hi, never enters loop,
 * but also doesn't check arr[lo]. Single element not found → wrong result.
 * Actually: this bug variant returns -1 for single-element arrays when target exists.
 */
export function binarySearch(arr: number[], target: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return -1;

  let lo = 0;
  let hi = arr.length - 1;

  while (lo < hi) { // BUG: when lo === hi (single element), loop never executes
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < target) {
      lo = mid + 1;
    } else if (arr[mid] > target) {
      hi = mid - 1; // BUG: standard narrowing without left-bias
    } else {
      return mid; // found, but doesn't guarantee first occurrence
    }
  }

  // BUG: doesn't check arr[lo] when lo === hi
  return -1;
}
