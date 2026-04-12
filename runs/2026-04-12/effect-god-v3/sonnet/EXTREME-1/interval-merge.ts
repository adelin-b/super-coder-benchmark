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

interface Seg {
  start: number;
  end: number;
}

function subtractRange(segs: Seg[], rs: number, re: number): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    if (s.end <= rs || s.start >= re) {
      out.push({ start: s.start, end: s.end });
    } else {
      if (s.start < rs) out.push({ start: s.start, end: rs });
      if (s.end > re) out.push({ start: re, end: s.end });
    }
  }
  return out;
}

function subtractSegs(from: Seg[], remove: Seg[]): Seg[] {
  let r = from.slice();
  for (const seg of remove) r = subtractRange(r, seg.start, seg.end);
  return r;
}

function intersect(a: Seg[], b: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const sa of a) {
    for (const sb of b) {
      const s = Math.max(sa.start, sb.start);
      const e = Math.min(sa.end, sb.end);
      if (s < e) out.push({ start: s, end: e });
    }
  }
  return coalesce(out);
}

function coalesce(segs: Seg[]): Seg[] {
  if (!segs.length) return [];
  const sorted = segs.slice().sort((a, b) =>
    a.start !== b.start ? a.start - b.start : a.end - b.end
  );
  const out: Seg[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out.filter(s => s.start < s.end);
}

function resolveResource(events: EventInput[]): Map<string, Seg[]> {
  const surviving = new Map<string, Seg[]>();
  for (const e of events) {
    surviving.set(e.id, [{ start: e.start, end: e.end }]);
  }

  const priorities = [...new Set(events.map(e => e.priority))].sort((a, b) => b - a);

  // Accumulated suppression from higher-priority events (claimed intervals + blocking windows)
  let suppression: Seg[] = [];

  for (const p of priorities) {
    const grp = events.filter(e => e.priority === p);

    // Apply suppression from higher-priority events to each event in this group
    for (const e of grp) {
      surviving.set(e.id, subtractSegs(surviving.get(e.id)!, suppression));
    }

    // Resolve equal-priority overlaps within this group
    // Sort by original start time ascending, then id ascending
    const sorted = grp.slice().sort((a, b) =>
      a.start !== b.start ? a.start - b.start : a.id < b.id ? -1 : 1
    );

    // Process all pairs (j, i) where j < i (j is earlier/smaller-id)
    for (let i = 1; i < sorted.length; i++) {
      for (let j = 0; j < i; j++) {
        const eA = sorted[j]; // goes first (earlier start or smaller id)
        const eB = sorted[i]; // goes second

        const ol = intersect(surviving.get(eA.id)!, surviving.get(eB.id)!);
        if (!ol.length) continue;

        const dA = eA.end - eA.start; // original durations
        const dB = eB.end - eB.start;

        let newA = surviving.get(eA.id)!.slice();
        let newB = surviving.get(eB.id)!.slice();

        for (const seg of ol) {
          const ms = seg.end - seg.start;
          const aShare = Math.floor((ms * dA) / (dA + dB));
          const bShare = ms - aShare;

          // Remove the overlap region from both
          newA = subtractRange(newA, seg.start, seg.end);
          newB = subtractRange(newB, seg.start, seg.end);

          // A gets its share at the start of the overlap region
          if (aShare > 0) newA.push({ start: seg.start, end: seg.start + aShare });
          // B gets the remainder
          if (bShare > 0) newB.push({ start: seg.start + aShare, end: seg.end });

          newA = coalesce(newA);
          newB = coalesce(newB);
        }

        surviving.set(eA.id, newA);
        surviving.set(eB.id, newB);
      }
    }

    // Update suppression for lower-priority groups:
    // - Add claimed intervals of all events at this priority
    // - Add FULL ORIGINAL window for blocking events (not just claimed)
    for (const e of grp) {
      const claimed = surviving.get(e.id)!;
      suppression = coalesce([...suppression, ...claimed]);
      if (e.blocking) {
        suppression = coalesce([...suppression, { start: e.start, end: e.end }]);
      }
    }
  }

  // Final cleanup: remove zero-duration and merge adjacent
  for (const [id, segs] of surviving) {
    surviving.set(id, coalesce(segs));
  }

  return surviving;
}

export function createScheduler(): {
  addEvent(event: EventInput): void;
  resolve(): ResolvedInterval[];
  getFragments(eventId: string): ResolvedInterval[];
} {
  const events: EventInput[] = [];
  const ids = new Set<string>();

  const doResolve = (): ResolvedInterval[] => {
    // Group events by resource
    const byResource = new Map<string, EventInput[]>();
    for (const e of events) {
      const arr = byResource.get(e.resource);
      if (arr) arr.push(e);
      else byResource.set(e.resource, [e]);
    }

    // Resolve each resource independently
    const fragMap = new Map<string, Seg[]>();
    for (const [, evts] of byResource) {
      const resolved = resolveResource(evts);
      for (const [id, segs] of resolved) fragMap.set(id, segs);
    }

    // Build ResolvedInterval list, assigning fragment indices in chronological order
    const result: ResolvedInterval[] = [];
    for (const e of events) {
      const segs = fragMap.get(e.id) ?? [];
      // segs are already sorted by coalesce (start ascending) and adjacent fragments merged
      for (let i = 0; i < segs.length; i++) {
        result.push({
          eventId: `${e.id}.${i}`,
          originalEventId: e.id,
          resource: e.resource,
          start: segs[i].start,
          end: segs[i].end,
          priority: e.priority,
        });
      }
    }

    // Sort: start asc, priority desc, eventId asc
    result.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
    });

    return result;
  };

  return {
    addEvent(event: EventInput): void {
      if (!event.id || event.id.length === 0) {
        throw new Error("id must be non-empty");
      }
      if (ids.has(event.id)) {
        throw new Error(`Duplicate event id: ${event.id}`);
      }
      if (!event.resource || event.resource.length === 0) {
        throw new Error("resource must be non-empty");
      }
      if (event.start >= event.end) {
        throw new Error("start must be < end");
      }
      if (event.priority < 0) {
        throw new Error("priority must be >= 0");
      }
      ids.add(event.id);
      events.push({ ...event });
    },

    resolve(): ResolvedInterval[] {
      return doResolve();
    },

    getFragments(eventId: string): ResolvedInterval[] {
      return doResolve()
        .filter(r => r.originalEventId === eventId)
        .sort((a, b) => a.start - b.start);
    },
  };
}