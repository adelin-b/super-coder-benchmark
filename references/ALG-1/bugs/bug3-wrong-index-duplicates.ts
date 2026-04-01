/**
 * BUG 3: wrong_index_duplicates
 * Standard binary search without left-biasing — returns ANY matching index,
 * not necessarily the first occurrence.
 */
export function binarySearch(arr: number[], target: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return -1;

  let lo = 0;
  let hi = arr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] < target) {
      lo = mid + 1;
    } else if (arr[mid] > target) {
      hi = mid - 1;
    } else {
      return mid; // BUG: returns first match found, not first occurrence
    }
  }

  return -1;
}
