/**
 * BUG 1: off_by_one_bounds
 * Uses hi = arr.length instead of arr.length - 1
 * Can access arr[arr.length] which is undefined
 */
export function binarySearch(arr: number[], target: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return -1;

  let lo = 0;
  let hi = arr.length; // BUG: should be arr.length - 1

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return arr[lo] === target ? lo : -1;
}
