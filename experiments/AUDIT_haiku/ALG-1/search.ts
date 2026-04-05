export function binarySearch(arr: number[], target: number): number {
  // Handle empty array
  if (arr.length === 0) {
    return -1;
  }
  
  let lo = 0;
  let hi = arr.length - 1;
  let foundIndex = -1;
  
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    
    if (arr[mid] === target) {
      foundIndex = mid;
      // Continue searching left for the first occurrence
      hi = mid - 1;
    } else if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  
  return foundIndex;
}