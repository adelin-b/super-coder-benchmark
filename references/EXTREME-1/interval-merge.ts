export interface EventInput {
  id: string;
  resource: string;
  start: number;
  end: number;
  priority: number;
  blocking?: boolean;
}

export interface ResolvedInterval {
  eventId: string;
  originalEventId: string;
  resource: string;
  start: number;
  end: number;
  priority: number;
}

interface InternalEvent extends EventInput {
  originalDuration: number;
}

export function createScheduler() {
  const events: InternalEvent[] = [];
  const eventIds = new Set<string>();
  let resolved: ResolvedInterval[] | null = null;

  return {
    addEvent(event: EventInput): void {
      if (!event.id || typeof event.id !== 'string') throw new Error('id must be non-empty');
      if (eventIds.has(event.id)) throw new Error(`Duplicate event ID: ${event.id}`);
      if (!event.resource || typeof event.resource !== 'string') throw new Error('resource must be non-empty');
      if (event.start >= event.end) throw new Error('start must be < end');
      if (event.priority < 0) throw new Error('priority must be >= 0');
      eventIds.add(event.id);
      events.push({ ...event, originalDuration: event.end - event.start });
      resolved = null;
    },

    resolve(): ResolvedInterval[] {
      if (resolved) return [...resolved];

      // Group by resource
      const byResource = new Map<string, InternalEvent[]>();
      for (const evt of events) {
        if (!byResource.has(evt.resource)) byResource.set(evt.resource, []);
        byResource.get(evt.resource)!.push(evt);
      }

      const allFragments: ResolvedInterval[] = [];

      for (const [resource, resEvents] of byResource) {
        const fragments = resolveResource(resEvents, resource);
        allFragments.push(...fragments);
      }

      // Sort by start asc, priority desc, eventId asc
      allFragments.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.eventId.localeCompare(b.eventId);
      });

      resolved = allFragments;
      return [...resolved];
    },

    getFragments(eventId: string): ResolvedInterval[] {
      if (!resolved) this.resolve();
      return resolved!
        .filter(f => f.originalEventId === eventId)
        .sort((a, b) => a.start - b.start);
    },
  };
}

type Segment = { start: number; end: number };

function resolveResource(events: InternalEvent[], resource: string): ResolvedInterval[] {
  // Step 1: Compute blocking windows (union of all blocking event ranges)
  // For each priority level, blocking events suppress lower-priority events
  const blockingEvents = events.filter(e => e.blocking);

  // Step 2: For each event, compute its "allowed" time segments after
  // applying blocking suppression and priority conflicts.

  // Sort events by priority desc, then start asc, then id asc
  const sorted = [...events].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.start !== b.start) return a.start - b.start;
    return a.id.localeCompare(b.id);
  });

  // Track occupied segments per resource (segments already claimed)
  // Process from highest priority to lowest
  // For each event, subtract occupied segments and blocking windows from higher-priority events

  // Map from event ID to its final segments
  const eventSegments = new Map<string, Segment[]>();

  // Group by priority for equal-priority handling
  const priorityGroups = new Map<number, InternalEvent[]>();
  for (const evt of sorted) {
    if (!priorityGroups.has(evt.priority)) priorityGroups.set(evt.priority, []);
    priorityGroups.get(evt.priority)!.push(evt);
  }

  const priorities = [...priorityGroups.keys()].sort((a, b) => b - a);

  // Occupied segments: what's already claimed by higher-priority events
  let occupiedSegments: Segment[] = [];
  // Blocking windows from higher-or-equal priority blocking events
  // For each priority level, we accumulate blocking windows from STRICTLY higher priority
  let blockingWindows: Segment[] = [];

  for (const pri of priorities) {
    const group = priorityGroups.get(pri)!;

    // Sort group by start asc, then id asc
    group.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.id.localeCompare(b.id);
    });

    if (group.length === 1) {
      // Single event at this priority: subtract occupied + blocking
      const evt = group[0];
      let segments: Segment[] = [{ start: evt.start, end: evt.end }];
      segments = subtractSegments(segments, occupiedSegments);
      segments = subtractSegments(segments, blockingWindows);
      segments = mergeAdjacentSegments(segments);
      segments = segments.filter(s => s.end > s.start);
      eventSegments.set(evt.id, segments);

      // Add this event's claimed segments to occupied
      occupiedSegments = unionSegments(occupiedSegments, segments);

      // If this event is blocking, add its full range to blocking windows for lower priorities
      if (evt.blocking) {
        blockingWindows = unionSegments(blockingWindows, [{ start: evt.start, end: evt.end }]);
      }
    } else {
      // Multiple events at the same priority: handle pairwise proportional splits
      // First subtract occupied + blocking from each
      const available = new Map<string, Segment[]>();
      for (const evt of group) {
        let segments: Segment[] = [{ start: evt.start, end: evt.end }];
        segments = subtractSegments(segments, occupiedSegments);
        segments = subtractSegments(segments, blockingWindows);
        segments = segments.filter(s => s.end > s.start);
        available.set(evt.id, segments);
      }

      // Now resolve overlaps among equal-priority events
      resolveEqualPriorityGroup(group, available);

      // Collect final segments and add to occupied
      for (const evt of group) {
        const segs = available.get(evt.id)!;
        const merged = mergeAdjacentSegments(segs.filter(s => s.end > s.start));
        eventSegments.set(evt.id, merged);
        occupiedSegments = unionSegments(occupiedSegments, merged);

        if (evt.blocking) {
          blockingWindows = unionSegments(blockingWindows, [{ start: evt.start, end: evt.end }]);
        }
      }
    }
  }

  // Build resolved intervals with fragment IDs
  const result: ResolvedInterval[] = [];
  for (const evt of events) {
    const segs = eventSegments.get(evt.id) || [];
    const merged = mergeAdjacentSegments(segs.filter(s => s.end > s.start));
    for (let i = 0; i < merged.length; i++) {
      result.push({
        eventId: `${evt.id}.${i}`,
        originalEventId: evt.id,
        resource,
        start: merged[i].start,
        end: merged[i].end,
        priority: evt.priority,
      });
    }
  }

  return result;
}

function resolveEqualPriorityGroup(
  group: InternalEvent[],
  available: Map<string, Segment[]>,
): void {
  // Process pairs: for each pair of events, split overlapping portions proportionally
  // Process in order: earlier start first, then by id
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const evtA = group[i];
      const evtB = group[j];
      splitEqualPriorityPair(evtA, evtB, available);
    }
  }
}

function splitEqualPriorityPair(
  evtA: InternalEvent,
  evtB: InternalEvent,
  available: Map<string, Segment[]>,
): void {
  const segsA = available.get(evtA.id)!;
  const segsB = available.get(evtB.id)!;

  // Find overlapping regions between segsA and segsB
  const overlaps = intersectSegments(segsA, segsB);
  if (overlaps.length === 0) return;

  const totalOverlap = overlaps.reduce((sum, s) => sum + (s.end - s.start), 0);
  if (totalOverlap === 0) return;

  const dA = evtA.originalDuration;
  const dB = evtB.originalDuration;
  const shareA = Math.floor(totalOverlap * (dA / (dA + dB)));
  const shareB = totalOverlap - shareA;

  // Determine who goes first in the overlap: earlier start, or lexicographic ID
  let firstEvt = evtA;
  let secondEvt = evtB;
  let firstShare = shareA;
  let secondShare = shareB;

  if (evtA.start > evtB.start || (evtA.start === evtB.start && evtA.id > evtB.id)) {
    firstEvt = evtB;
    secondEvt = evtA;
    firstShare = shareB;
    secondShare = shareA;
  }

  // Allocate: first event gets first `firstShare` ms of overlap, second gets rest
  // Walk through overlap segments and split
  const firstSegments: Segment[] = [];
  const secondSegments: Segment[] = [];
  let remaining = firstShare;

  for (const seg of overlaps) {
    const segLen = seg.end - seg.start;
    if (remaining >= segLen) {
      firstSegments.push({ ...seg });
      remaining -= segLen;
    } else if (remaining > 0) {
      firstSegments.push({ start: seg.start, end: seg.start + remaining });
      secondSegments.push({ start: seg.start + remaining, end: seg.end });
      remaining = 0;
    } else {
      secondSegments.push({ ...seg });
    }
  }

  // Remove all overlaps from both, then add back their shares
  const newSegsFirst = subtractSegments(available.get(firstEvt.id)!, overlaps);
  const newSegsSecond = subtractSegments(available.get(secondEvt.id)!, overlaps);

  available.set(firstEvt.id, [...newSegsFirst, ...firstSegments].sort((a, b) => a.start - b.start));
  available.set(secondEvt.id, [...newSegsSecond, ...secondSegments].sort((a, b) => a.start - b.start));
}

// Subtract `toRemove` segments from `source` segments
function subtractSegments(source: Segment[], toRemove: Segment[]): Segment[] {
  let result = [...source];
  for (const rem of toRemove) {
    const next: Segment[] = [];
    for (const seg of result) {
      if (seg.end <= rem.start || seg.start >= rem.end) {
        // No overlap
        next.push(seg);
      } else {
        // Overlap: split
        if (seg.start < rem.start) {
          next.push({ start: seg.start, end: rem.start });
        }
        if (seg.end > rem.end) {
          next.push({ start: rem.end, end: seg.end });
        }
      }
    }
    result = next;
  }
  return result;
}

// Find intersection of two segment lists
function intersectSegments(a: Segment[], b: Segment[]): Segment[] {
  const result: Segment[] = [];
  let i = 0, j = 0;
  const sa = [...a].sort((x, y) => x.start - y.start);
  const sb = [...b].sort((x, y) => x.start - y.start);

  while (i < sa.length && j < sb.length) {
    const start = Math.max(sa[i].start, sb[j].start);
    const end = Math.min(sa[i].end, sb[j].end);
    if (start < end) {
      result.push({ start, end });
    }
    if (sa[i].end < sb[j].end) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}

// Union segments (merge overlapping/adjacent)
function unionSegments(a: Segment[], b: Segment[]): Segment[] {
  const all = [...a, ...b].sort((x, y) => x.start - y.start);
  if (all.length === 0) return [];
  const merged: Segment[] = [{ ...all[0] }];
  for (let i = 1; i < all.length; i++) {
    const last = merged[merged.length - 1];
    if (all[i].start <= last.end) {
      last.end = Math.max(last.end, all[i].end);
    } else {
      merged.push({ ...all[i] });
    }
  }
  return merged;
}

// Merge adjacent segments of the same event (end of one === start of next)
function mergeAdjacentSegments(segments: Segment[]): Segment[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Segment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}
