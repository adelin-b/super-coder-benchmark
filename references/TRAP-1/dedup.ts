export interface Item {
  id: string;
  value: number;
  timestamp: number;
}

export function removeDuplicates(items: Item[]): Item[] {
  // Validate
  for (const item of items) {
    if (item.id === '') {
      throw new Error('Invalid item: empty id');
    }
    if (!Number.isFinite(item.value) || !Number.isFinite(item.timestamp)) {
      throw new Error('Invalid item: non-finite number');
    }
  }

  // Group by id, keeping the best item per group:
  // - Highest timestamp wins
  // - If timestamps equal, lowest value wins
  // - If both equal, first occurrence wins (tracked via original index)
  const best = new Map<string, { item: Item; index: number }>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const existing = best.get(item.id);
    if (!existing) {
      best.set(item.id, { item, index: i });
    } else {
      if (
        item.timestamp > existing.item.timestamp ||
        (item.timestamp === existing.item.timestamp && item.value < existing.item.value)
      ) {
        best.set(item.id, { item, index: i });
      }
      // If timestamps equal and values equal, keep first occurrence (do nothing)
    }
  }

  // Sort by id ascending
  const result = Array.from(best.values())
    .sort((a, b) => a.item.id.localeCompare(b.item.id))
    .map(entry => ({ ...entry.item }));

  return result;
}
