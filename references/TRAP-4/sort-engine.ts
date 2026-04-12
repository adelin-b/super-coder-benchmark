export interface SortKey {
  field: string;
  direction: 'ascending' | 'descending';
  invertComparison?: boolean;
  nulls?: 'first' | 'last';
  caseSensitive?: boolean;
}

export interface SortConfig {
  keys: SortKey[];
}

export interface Item {
  [key: string]: unknown;
}

export function createSortEngine(config: SortConfig): {
  sort(items: Item[]): Item[];
  compare(a: Item, b: Item): number;
} {
  if (config.keys.length === 0) {
    throw new Error('No sort keys provided');
  }
  for (const key of config.keys) {
    if (!key.field || key.field === '') {
      throw new Error('Empty field name');
    }
  }

  function isNullish(v: unknown): boolean {
    return v === null || v === undefined;
  }

  function typeRank(v: unknown): string {
    return typeof v;
  }

  function compareOneKey(a: Item, b: Item, key: SortKey): number {
    const aVal = a[key.field];
    const bVal = b[key.field];
    const nulls = key.nulls ?? 'last';
    const invertComparison = key.invertComparison ?? false;
    const caseSensitive = key.caseSensitive ?? true;
    const direction = key.direction;

    const aNull = isNullish(aVal);
    const bNull = isNullish(bVal);

    // Step 1: Null handling (ABSOLUTE, unaffected by direction/inversion)
    if (aNull && bNull) return 0;
    if (aNull) return nulls === 'first' ? -1 : 1;
    if (bNull) return nulls === 'first' ? 1 : -1;

    // Step 2: Raw comparison (both non-null)
    let raw: number;
    const aType = typeof aVal;
    const bType = typeof bVal;

    if (aType !== bType) {
      // Mixed types: compare by type name
      raw = typeRank(aVal) < typeRank(bVal) ? -1 : 1;
    } else if (aType === 'string') {
      const aStr = caseSensitive ? (aVal as string) : (aVal as string).toLowerCase();
      const bStr = caseSensitive ? (bVal as string) : (bVal as string).toLowerCase();
      raw = aStr.localeCompare(bStr);
    } else if (aType === 'number') {
      raw = (aVal as number) - (bVal as number);
    } else if (aType === 'boolean') {
      // false < true
      raw = (aVal === bVal) ? 0 : (aVal ? 1 : -1);
    } else {
      raw = 0;
    }

    // Step 3: Apply inversion
    if (invertComparison) {
      raw = -raw;
    }

    // Step 4: Apply direction
    if (direction === 'descending') {
      raw = -raw;
    }

    return raw;
  }

  function compare(a: Item, b: Item): number {
    for (const key of config.keys) {
      const result = compareOneKey(a, b, key);
      if (result !== 0) return result;
    }
    return 0;
  }

  function sort(items: Item[]): Item[] {
    // Stable sort: Array.prototype.sort is stable in modern JS engines
    const copy = [...items];
    copy.sort(compare);
    return copy;
  }

  return { sort, compare };
}
