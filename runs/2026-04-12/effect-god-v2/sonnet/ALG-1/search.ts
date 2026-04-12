import { Effect, Data } from "effect";

class SearchError extends Data.TaggedError("SearchError")<{ reason: string }> {}

const binarySearchEffect = (
  arr: number[],
  target: number
): Effect.Effect<number, SearchError> =>
  Effect.gen(function* () {
    if (arr.length === 0) return -1;

    let lo = 0;
    let hi = arr.length - 1;
    let result = -1;

    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (arr[mid] === target) {
        result = mid;
        hi = mid - 1; // bias left: keep searching for first occurrence
      } else if (arr[mid] < target) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  });

export function binarySearch(arr: number[], target: number): number {
  const exit = Effect.runSyncExit(binarySearchEffect(arr, target));
  if (exit._tag === "Failure") {
    throw new Error("binarySearch failed unexpectedly");
  }
  return exit.value;
}