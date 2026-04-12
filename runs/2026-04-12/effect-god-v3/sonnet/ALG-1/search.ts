export function binarySearch(arr: number[], target: number): number {
  if (arr.length === 0) return -1;

  let lo = 0;
  let hi = arr.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);

    if (arr[mid] === target) {
      result = mid;
      hi = mid - 1; // left-bias: keep searching left for first occurrence
    } else if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}