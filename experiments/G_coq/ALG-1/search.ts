/**
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
}
