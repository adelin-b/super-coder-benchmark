import { Effect, Data } from "effect";

// ── Internal tagged errors ──────────────────────────────────────────────────

class NoKeysError extends Data.TaggedError("NoKeysError")<{}> {}
class EmptyFieldError extends Data.TaggedError("EmptyFieldError")<{}> {}

// ── Public API types ────────────────────────────────────────────────────────

export interface SortKey {
  field: string;
  direction: "ascending" | "descending";
  invertComparison?: boolean;
  nulls?: "first" | "last";
  caseSensitive?: boolean;
}

export interface SortConfig {
  keys: SortKey[];
}

export interface Item {
  [key: string]: unknown;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function isNullish(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

function rawCompare(a: unknown, b: unknown, caseSensitive: boolean): number {
  const ta = typeof a;
  const tb = typeof b;

  if (ta !== tb) {
    // compare by type name string: "boolean" < "number" < "string"
    return ta < tb ? -1 : 1;
  }

  if (ta === "string") {
    const sa = caseSensitive ? (a as string) : (a as string).toLowerCase();
    const sb = caseSensitive ? (b as string) : (b as string).toLowerCase();
    return sa.localeCompare(sb);
  }

  if (ta === "number") {
    const na = a as number;
    const nb = b as number;
    return na < nb ? -1 : na > nb ? 1 : 0;
  }

  if (ta === "boolean") {
    const ba = a as boolean;
    const bb = b as boolean;
    return ba === bb ? 0 : ba ? 1 : -1;
  }

  // Fallback: compare string representations
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function compareByKey(key: SortKey, a: Item, b: Item): number {
  const av = a[key.field];
  const bv = b[key.field];

  const nullPlacement = key.nulls ?? "last";
  const aNull = isNullish(av);
  const bNull = isNullish(bv);

  // Step 2: Null handling — absolute, unaffected by direction/inversion
  if (aNull && bNull) return 0;
  if (aNull) return nullPlacement === "first" ? -1 : 1;
  if (bNull) return nullPlacement === "first" ? 1 : -1;

  // Step 3: Raw comparison
  let cmp = rawCompare(av, bv, key.caseSensitive ?? true);

  // Step 4: Apply inversion
  if (key.invertComparison) cmp = -cmp;

  // Step 5: Apply direction
  if (key.direction === "descending") cmp = -cmp;

  return cmp;
}

// ── Internal Effect logic ───────────────────────────────────────────────────

const validateConfig = (
  config: SortConfig
): Effect.Effect<SortConfig, NoKeysError | EmptyFieldError> =>
  Effect.gen(function* () {
    if (!config.keys || config.keys.length === 0) {
      yield* Effect.fail(new NoKeysError({}));
    }
    for (const key of config.keys) {
      if (!key.field || key.field.length === 0) {
        yield* Effect.fail(new EmptyFieldError({}));
      }
    }
    return config;
  });

// ── Public factory ──────────────────────────────────────────────────────────

export function createSortEngine(config: SortConfig): {
  sort(items: Item[]): Item[];
  compare(a: Item, b: Item): number;
} {
  // Validate eagerly at construction time
  const exit = Effect.runSyncExit(validateConfig(config));

  if (exit._tag === "Failure") {
    const raw = exit.cause;
    // Extract the tagged error
    if (raw._tag === "Fail") {
      const err = (raw as any).error;
      if (err._tag === "NoKeysError") throw new Error("No sort keys provided");
      if (err._tag === "EmptyFieldError") throw new Error("Empty field name");
    }
    throw new Error("Invalid sort configuration");
  }

  const keys = config.keys;

  function compare(a: Item, b: Item): number {
    for (const key of keys) {
      const cmp = compareByKey(key, a, b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }

  function sort(items: Item[]): Item[] {
    // Stable sort: tag with original index, sort, strip tag
    const indexed = items.map((item, idx) => ({ item, idx }));
    indexed.sort((x, y) => {
      const cmp = compare(x.item, y.item);
      return cmp !== 0 ? cmp : x.idx - y.idx;
    });
    return indexed.map((x) => x.item);
  }

  return { sort, compare };
}