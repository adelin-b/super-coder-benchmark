# EXTREME-1: Interval Merge with Priority Conflicts

## Overview
Implement a scheduling system where time intervals have priorities and resource IDs. The system must resolve overlapping intervals by priority, split conflicts proportionally for equal priorities, handle blocking events, and manage fragments correctly.

## Exported API

```ts
export interface EventInput {
  id: string;
  resource: string;
  start: number;        // milliseconds
  end: number;          // milliseconds
  priority: number;     // higher = wins conflicts
  blocking?: boolean;   // suppresses ALL lower-priority events on same resource
}

export interface ResolvedInterval {
  eventId: string;       // original ID with fragment suffix (e.g., "evt1.0")
  originalEventId: string;
  resource: string;
  start: number;
  end: number;
  priority: number;
}

export function createScheduler(): {
  addEvent(event: EventInput): void;
  resolve(): ResolvedInterval[];
  getFragments(eventId: string): ResolvedInterval[];
};
```

## Detailed Requirements

### Priority Resolution
- When two events overlap on the same resource and have DIFFERENT priorities, the higher-priority event claims the overlapping time region completely.
- The lower-priority event is SPLIT into fragments that cover only the non-overlapping portions (before and/or after the higher-priority event).
- A single lower-priority event may be split into 0, 1, or 2 fragments depending on overlap geometry.

### Equal Priority Proportional Split
- When two events overlap on the same resource with EQUAL priority, the overlapping time region is split proportionally by their original durations.
- Event A (original duration `dA`) and Event B (original duration `dB`) overlap for `overlapMs` milliseconds.
  - A gets `overlapMs * (dA / (dA + dB))` of the overlap (rounded down to integer ms).
  - B gets the remainder: `overlapMs - A's share`.
- The event that starts earlier gets its share at the START of the overlap region. If they start at the same time, the event with the lexicographically smaller ID gets its share first.
- Each event may produce fragments for its non-overlapping portions plus its share of the overlap.

### Blocking Events
- An event with `blocking: true` suppresses ALL lower-priority events on the same resource for the ENTIRE duration of the blocking event, even events that don't overlap in time.
- "Suppressed" means the lower-priority event produces zero fragments during the blocking window.
- If a lower-priority event extends beyond the blocking window, only the portions outside the blocking window survive.
- Blocking does NOT affect events with equal or higher priority.
- Multiple blocking events on the same resource stack: the union of their windows is the suppression zone for lower-priority events.

### Fragment Management
- Each fragment gets an ID of the form `"{originalId}.{index}"` where index starts at 0.
- If an event is not split at all, it still gets the `.0` suffix.
- Zero-duration fragments (start === end) are removed entirely.
- Adjacent fragments of the same original event (fragment A's end === fragment B's start) are re-merged into a single fragment.
- Fragment indices are assigned in chronological order (by start time).

### Output Ordering
- The resolved intervals are sorted by:
  1. `start` ascending
  2. `priority` descending
  3. `eventId` ascending (lexicographic)

### Validation
- `id` must be non-empty and unique across all added events.
- `start` must be < `end` (positive duration).
- `priority` must be >= 0.
- `resource` must be non-empty.
- Throw `Error` on invalid input.

### Edge Cases
- Events on different resources never interact.
- An event completely contained within a higher-priority event produces zero fragments (fully suppressed).
- A higher-priority event completely contained within a lower-priority event splits the lower into two fragments (before and after).
- Three or more events overlapping on the same resource: resolve pairwise from highest to lowest priority. Equal priorities are resolved pairwise in order of start time (earlier first), then by ID.
- `getFragments(eventId)` returns all fragments for the given original event ID, sorted by start time. Returns empty array if the event was fully suppressed.

## Invariants
1. No two resolved intervals on the same resource overlap in time.
2. The union of all resolved intervals for a given original event covers a subset of [event.start, event.end].
3. Fragment indices are sequential starting from 0 with no gaps.
4. Every added event appears in the output (possibly with 0 fragments if fully suppressed).
5. `getFragments` returns fragments sorted by start time.
