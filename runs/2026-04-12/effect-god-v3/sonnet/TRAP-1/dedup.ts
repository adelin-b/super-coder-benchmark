import { Effect, Data } from "effect";

export interface Item {
  id: string;
  value: number;
  timestamp: number;
}

class InvalidEmptyId extends Data.TaggedError("InvalidEmptyId")<{}> {}
class InvalidNonFinite extends Data.TaggedError("InvalidNonFinite")<{}> {}

const removeDuplicatesEffect = (
  items: Item[]
): Effect.Effect<Item[], InvalidEmptyId | InvalidNonFinite> =>
  Effect.gen(function* () {
    for (const item of items) {
      if (item.id === "") {
        yield* Effect.fail(new InvalidEmptyId());
      }
      if (!Number.isFinite(item.value) || !Number.isFinite(item.timestamp)) {
        yield* Effect.fail(new InvalidNonFinite());
      }
    }

    const map = new Map<string, { item: Item; originalIndex: number }>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const existing = map.get(item.id);

      if (!existing) {
        map.set(item.id, { item, originalIndex: i });
      } else {
        const e = existing.item;
        if (item.timestamp > e.timestamp) {
          map.set(item.id, { item, originalIndex: i });
        } else if (item.timestamp === e.timestamp && item.value < e.value) {
          map.set(item.id, { item, originalIndex: i });
        }
        // else keep existing (first occurrence wins on full tie)
      }
    }

    const result = Array.from(map.values()).map((v) => v.item);
    result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return result;
  });

export function removeDuplicates(items: Item[]): Item[] {
  const exit = Effect.runSyncExit(removeDuplicatesEffect(items));

  if (exit._tag === "Failure") {
    const cause = exit.cause;
    if (cause._tag === "Fail") {
      const err = cause.error;
      if (err._tag === "InvalidEmptyId") {
        throw new Error("Invalid item: empty id");
      }
      if (err._tag === "InvalidNonFinite") {
        throw new Error("Invalid item: non-finite number");
      }
    }
    throw new Error("Unexpected error");
  }

  return exit.value;
}