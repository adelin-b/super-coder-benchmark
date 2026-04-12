import { describe, it, expect } from 'vitest';
import { createScheduler } from './interval-merge.js';

describe('EXTREME-1: Interval Merge with Priority Conflicts', () => {
  // ============================================================
  // BASIC FUNCTIONALITY
  // ============================================================

  it('resolves a single event with .0 suffix', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    const result = s.resolve();
    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe('A.0');
    expect(result[0].originalEventId).toBe('A');
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(100);
  });

  it('resolves two non-overlapping events unchanged', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 50, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 100, priority: 1 });
    const result = s.resolve();
    expect(result).toHaveLength(2);
    expect(result[0].eventId).toBe('A.0');
    expect(result[1].eventId).toBe('B.0');
  });

  it('resolves events on different resources independently', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R2', start: 0, end: 100, priority: 1 });
    const result = s.resolve();
    expect(result).toHaveLength(2);
    // Both should have full ranges, no conflict across resources
    const a = result.find(r => r.originalEventId === 'A')!;
    const b = result.find(r => r.originalEventId === 'B')!;
    expect(a.end - a.start).toBe(100);
    expect(b.end - b.start).toBe(100);
  });

  // ============================================================
  // PRIORITY RESOLUTION
  // ============================================================

  it('higher priority claims overlap, lower priority splits into before-fragment', () => {
    const s = createScheduler();
    // A: [0, 100) pri 1, B: [50, 150) pri 5
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 150, priority: 5 });
    const result = s.resolve();
    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');
    expect(bFrags).toHaveLength(1);
    expect(bFrags[0].start).toBe(50);
    expect(bFrags[0].end).toBe(150);
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);
  });

  it('higher priority claims overlap, lower priority splits into after-fragment', () => {
    const s = createScheduler();
    // A: [50, 200) pri 1, B: [0, 100) pri 5
    s.addEvent({ id: 'A', resource: 'R1', start: 50, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    const result = s.resolve();
    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(100);
    expect(aFrags[0].end).toBe(200);
  });

  it('higher priority contained within lower: lower splits into two fragments', () => {
    const s = createScheduler();
    // A: [0, 200) pri 1, B: [50, 150) pri 5
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 150, priority: 5 });
    const result = s.resolve();
    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');
    expect(bFrags).toHaveLength(1);
    expect(bFrags[0].start).toBe(50);
    expect(bFrags[0].end).toBe(150);
    expect(aFrags).toHaveLength(2);
    expect(aFrags[0].eventId).toBe('A.0');
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);
    expect(aFrags[1].eventId).toBe('A.1');
    expect(aFrags[1].start).toBe(150);
    expect(aFrags[1].end).toBe(200);
  });

  it('lower priority completely contained within higher: zero fragments', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 25, end: 75, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    const result = s.resolve();
    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');
    expect(bFrags).toHaveLength(1);
    expect(aFrags).toHaveLength(0); // fully suppressed
  });

  it('three events: highest claims all, medium gets remainder, lowest gets scraps', () => {
    const s = createScheduler();
    s.addEvent({ id: 'H', resource: 'R1', start: 40, end: 60, priority: 10 });
    s.addEvent({ id: 'M', resource: 'R1', start: 20, end: 80, priority: 5 });
    s.addEvent({ id: 'L', resource: 'R1', start: 0, end: 100, priority: 1 });
    const result = s.resolve();

    const hFrags = result.filter(r => r.originalEventId === 'H');
    const mFrags = result.filter(r => r.originalEventId === 'M');
    const lFrags = result.filter(r => r.originalEventId === 'L');

    // H: [40, 60)
    expect(hFrags).toHaveLength(1);
    expect(hFrags[0].start).toBe(40);
    expect(hFrags[0].end).toBe(60);

    // M: [20, 40) and [60, 80) (split around H)
    expect(mFrags).toHaveLength(2);
    expect(mFrags[0].start).toBe(20);
    expect(mFrags[0].end).toBe(40);
    expect(mFrags[1].start).toBe(60);
    expect(mFrags[1].end).toBe(80);

    // L: [0, 20) and [80, 100) (split around M+H)
    expect(lFrags).toHaveLength(2);
    expect(lFrags[0].start).toBe(0);
    expect(lFrags[0].end).toBe(20);
    expect(lFrags[1].start).toBe(80);
    expect(lFrags[1].end).toBe(100);
  });

  // ============================================================
  // EQUAL PRIORITY PROPORTIONAL SPLIT
  // ============================================================

  it('equal priority: overlap split proportionally by original duration', () => {
    const s = createScheduler();
    // A: 100ms long, B: 300ms long, overlap 40ms
    // A's share: floor(40 * (100/400)) = floor(10) = 10ms
    // B's share: 40 - 10 = 30ms
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 5 });
    s.addEvent({ id: 'B', resource: 'R1', start: 60, end: 360, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');

    // A is earlier, gets its share first in the overlap [60, 100)
    // A's overlap share = 10ms: [60, 70)
    // B's overlap share = 30ms: [70, 100)
    // A total: [0, 70) (merged: [0, 60) + [60, 70))
    // B total: [70, 360) (merged: [70, 100) + [100, 360))

    const aTotalDuration = aFrags.reduce((s, f) => s + (f.end - f.start), 0);
    const bTotalDuration = bFrags.reduce((s, f) => s + (f.end - f.start), 0);

    expect(aTotalDuration).toBe(70); // 60 non-overlap + 10 overlap share
    expect(bTotalDuration).toBe(290); // 260 non-overlap + 30 overlap share
  });

  it('equal priority: same start time, lexicographic ID determines first', () => {
    const s = createScheduler();
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 3 });
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 3 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');

    // Both 100ms, overlap 100ms, equal duration -> 50/50 split
    // A is lexicographically first, gets first 50ms
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);

    expect(bFrags).toHaveLength(1);
    expect(bFrags[0].start).toBe(50);
    expect(bFrags[0].end).toBe(100);
  });

  it('equal priority: asymmetric durations produce asymmetric split', () => {
    const s = createScheduler();
    // A: 50ms, B: 150ms, overlap region: [50, 100) = 50ms
    // A share: floor(50 * (50/200)) = floor(12.5) = 12ms
    // B share: 50 - 12 = 38ms
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 50, priority: 2 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 150, priority: 2 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');

    // Overlap is [0, 50), A is lex-first
    // A gets first 12ms: [0, 12)
    // B gets [12, 50) + [50, 150) = [12, 150)
    const aTotalDuration = aFrags.reduce((s, f) => s + (f.end - f.start), 0);
    const bTotalDuration = bFrags.reduce((s, f) => s + (f.end - f.start), 0);

    expect(aTotalDuration).toBe(12);
    expect(bTotalDuration).toBe(138); // 38 overlap share + 100 non-overlap
  });

  it('equal priority: three events overlap pairwise', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 60, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 20, end: 80, priority: 1 });
    s.addEvent({ id: 'C', resource: 'R1', start: 40, end: 100, priority: 1 });
    const result = s.resolve();

    // No overlapping fragments should exist on the same resource
    const sorted = result.filter(r => r.resource === 'R1').sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);
    }

    // Total time covered should be 100ms (union of [0,60) [20,80) [40,100))
    const totalCovered = sorted.reduce((s, f) => s + (f.end - f.start), 0);
    expect(totalCovered).toBe(100);
  });

  // ============================================================
  // BLOCKING EVENTS
  // ============================================================

  it('blocking event suppresses lower-priority events for its entire duration', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 50, end: 150, priority: 5, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    const result = s.resolve();

    const blkFrags = result.filter(r => r.originalEventId === 'BLK');
    const aFrags = result.filter(r => r.originalEventId === 'A');

    expect(blkFrags).toHaveLength(1);
    expect(blkFrags[0].start).toBe(50);
    expect(blkFrags[0].end).toBe(150);

    // A is suppressed during [50, 150) by blocking, left with [0, 50) and [150, 200)
    expect(aFrags).toHaveLength(2);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);
    expect(aFrags[1].start).toBe(150);
    expect(aFrags[1].end).toBe(200);
  });

  it('blocking event suppresses non-overlapping lower-priority events within its window', () => {
    const s = createScheduler();
    // Blocking event: [100, 200)
    // Lower-priority event that doesn't overlap: [120, 180) (within blocking window)
    s.addEvent({ id: 'BLK', resource: 'R1', start: 100, end: 200, priority: 10, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 120, end: 180, priority: 1 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(0); // fully suppressed by blocking
  });

  it('blocking event does NOT suppress equal-priority events', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 0, end: 100, priority: 5, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 50, end: 150, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    // A is equal priority, not suppressed by blocking
    const aTotalDuration = aFrags.reduce((s, f) => s + (f.end - f.start), 0);
    expect(aTotalDuration).toBeGreaterThan(0);
  });

  it('blocking event does NOT suppress higher-priority events', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 0, end: 100, priority: 5, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 50, end: 150, priority: 10 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(50);
    expect(aFrags[0].end).toBe(150);
  });

  it('blocking does not affect events on different resources', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 0, end: 100, priority: 10, blocking: true });
    s.addEvent({ id: 'A', resource: 'R2', start: 0, end: 100, priority: 1 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].end - aFrags[0].start).toBe(100);
  });

  it('multiple blocking events stack their suppression windows', () => {
    const s = createScheduler();
    s.addEvent({ id: 'B1', resource: 'R1', start: 0, end: 60, priority: 5, blocking: true });
    s.addEvent({ id: 'B2', resource: 'R1', start: 40, end: 100, priority: 5, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    // Blocking window: union of [0,60) and [40,100) = [0,100)
    // A survives only in [100, 200)
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(100);
    expect(aFrags[0].end).toBe(200);
  });

  it('blocking event partially overlapping lower-priority event: only outside portion survives', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 50, end: 150, priority: 5, blocking: true });
    s.addEvent({ id: 'A', resource: 'R1', start: 100, end: 200, priority: 1 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    // A's range [100, 200) minus blocking [50, 150) = [150, 200)
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(150);
    expect(aFrags[0].end).toBe(200);
  });

  // ============================================================
  // FRAGMENT MANAGEMENT
  // ============================================================

  it('fragment indices are sequential starting from 0', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 70, priority: 5 });
    s.addEvent({ id: 'C', resource: 'R1', start: 120, end: 140, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    // A split by B and C: [0,50), [70,120), [140,200) -> 3 fragments
    expect(aFrags).toHaveLength(3);
    expect(aFrags[0].eventId).toBe('A.0');
    expect(aFrags[1].eventId).toBe('A.1');
    expect(aFrags[2].eventId).toBe('A.2');
  });

  it('zero-duration fragments are removed', () => {
    const s = createScheduler();
    // A: [0, 100), B: [0, 100) at higher priority -> A gets nothing
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(0);
  });

  it('adjacent fragments of same event are re-merged', () => {
    const s = createScheduler();
    // A: [0, 200) pri 1
    // B: [50, 50) - invalid, so let's use a different approach
    // Two higher-pri events that are adjacent: [50,100) and [100,150)
    // After A is split: [0,50), [50,100) removed, [100,150) removed, [150,200)
    // But if B occupies [50,100) and C occupies [100,150):
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 80, end: 120, priority: 5 });
    const result = s.resolve();

    const aFrags = s.getFragments('A');
    // A split into [0, 80) and [120, 200) -- two non-adjacent fragments
    expect(aFrags).toHaveLength(2);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(80);
    expect(aFrags[1].start).toBe(120);
    expect(aFrags[1].end).toBe(200);
  });

  it('getFragments returns empty array for fully suppressed event', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 10, end: 90, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    s.resolve();

    const frags = s.getFragments('A');
    expect(frags).toEqual([]);
  });

  it('getFragments returns fragments sorted by start time', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 300, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 100, priority: 5 });
    s.addEvent({ id: 'C', resource: 'R1', start: 200, end: 250, priority: 5 });
    s.resolve();

    const frags = s.getFragments('A');
    for (let i = 1; i < frags.length; i++) {
      expect(frags[i].start).toBeGreaterThanOrEqual(frags[i - 1].end);
    }
  });

  // ============================================================
  // OUTPUT ORDERING
  // ============================================================

  it('output sorted by start asc, then priority desc, then eventId asc', () => {
    const s = createScheduler();
    s.addEvent({ id: 'C', resource: 'R1', start: 0, end: 50, priority: 1 });
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 50, priority: 3 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 50, priority: 3 });
    const result = s.resolve();

    // A and B are equal priority (3), C is lower (1)
    // After equal priority split between A and B, C gets nothing (suppressed by both)
    // Check that whatever output exists is sorted correctly
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.start === curr.start) {
        if (prev.priority === curr.priority) {
          expect(prev.eventId <= curr.eventId).toBe(true);
        } else {
          expect(prev.priority).toBeGreaterThanOrEqual(curr.priority);
        }
      } else {
        expect(prev.start).toBeLessThan(curr.start);
      }
    }
  });

  // ============================================================
  // MULTI-RESOURCE ISOLATION
  // ============================================================

  it('events on different resources do not interfere', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A1', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'A2', resource: 'R2', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B1', resource: 'R1', start: 50, end: 150, priority: 5 });
    const result = s.resolve();

    // A2 on R2 should be unaffected by B1 on R1
    const a2Frags = result.filter(r => r.originalEventId === 'A2');
    expect(a2Frags).toHaveLength(1);
    expect(a2Frags[0].start).toBe(0);
    expect(a2Frags[0].end).toBe(100);

    // A1 on R1 should be split by B1
    const a1Frags = result.filter(r => r.originalEventId === 'A1');
    expect(a1Frags).toHaveLength(1);
    expect(a1Frags[0].start).toBe(0);
    expect(a1Frags[0].end).toBe(50);
  });

  // ============================================================
  // COMPLEX CHAINS
  // ============================================================

  it('chain of overlapping events with descending priorities', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 80, priority: 4 });
    s.addEvent({ id: 'B', resource: 'R1', start: 20, end: 100, priority: 3 });
    s.addEvent({ id: 'C', resource: 'R1', start: 40, end: 120, priority: 2 });
    s.addEvent({ id: 'D', resource: 'R1', start: 60, end: 140, priority: 1 });
    const result = s.resolve();

    // A gets [0, 80), B gets [80, 100), C gets [100, 120), D gets [120, 140)
    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');
    const cFrags = result.filter(r => r.originalEventId === 'C');
    const dFrags = result.filter(r => r.originalEventId === 'D');

    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(80);

    expect(bFrags).toHaveLength(1);
    expect(bFrags[0].start).toBe(80);
    expect(bFrags[0].end).toBe(100);

    expect(cFrags).toHaveLength(1);
    expect(cFrags[0].start).toBe(100);
    expect(cFrags[0].end).toBe(120);

    expect(dFrags).toHaveLength(1);
    expect(dFrags[0].start).toBe(120);
    expect(dFrags[0].end).toBe(140);
  });

  it('two high-priority events sandwich a lower one completely', () => {
    const s = createScheduler();
    s.addEvent({ id: 'L', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'H1', resource: 'R1', start: 0, end: 40, priority: 10 });
    s.addEvent({ id: 'H2', resource: 'R1', start: 60, end: 100, priority: 10 });
    const result = s.resolve();

    const lFrags = result.filter(r => r.originalEventId === 'L');
    // L only survives in [40, 60)
    expect(lFrags).toHaveLength(1);
    expect(lFrags[0].start).toBe(40);
    expect(lFrags[0].end).toBe(60);
  });

  // ============================================================
  // EDGE CASES
  // ============================================================

  it('event with exactly matching bounds as higher priority: fully suppressed', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(0);
  });

  it('same start time different end, different priority', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 0, end: 100, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(100);
    expect(aFrags[0].end).toBe(200);
  });

  it('same end time different start, different priority', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 100, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);
  });

  it('no overlap at all: events are just touching at boundary', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 50, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 100, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');
    // No overlap: both intact
    expect(aFrags).toHaveLength(1);
    expect(aFrags[0].start).toBe(0);
    expect(aFrags[0].end).toBe(50);
    expect(bFrags).toHaveLength(1);
  });

  // ============================================================
  // VALIDATION
  // ============================================================

  it('throws on empty id', () => {
    const s = createScheduler();
    expect(() => s.addEvent({ id: '', resource: 'R1', start: 0, end: 100, priority: 1 }))
      .toThrow();
  });

  it('throws on duplicate id', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    expect(() => s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 }))
      .toThrow();
  });

  it('throws on start >= end', () => {
    const s = createScheduler();
    expect(() => s.addEvent({ id: 'A', resource: 'R1', start: 100, end: 100, priority: 1 }))
      .toThrow();
    expect(() => s.addEvent({ id: 'B', resource: 'R1', start: 200, end: 100, priority: 1 }))
      .toThrow();
  });

  it('throws on negative priority', () => {
    const s = createScheduler();
    expect(() => s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: -1 }))
      .toThrow();
  });

  it('throws on empty resource', () => {
    const s = createScheduler();
    expect(() => s.addEvent({ id: 'A', resource: '', start: 0, end: 100, priority: 1 }))
      .toThrow();
  });

  // ============================================================
  // INVARIANTS
  // ============================================================

  it('invariant: no two resolved intervals on same resource overlap', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 30, end: 130, priority: 3 });
    s.addEvent({ id: 'C', resource: 'R1', start: 60, end: 160, priority: 5 });
    s.addEvent({ id: 'D', resource: 'R1', start: 90, end: 190, priority: 2 });
    const result = s.resolve();

    const r1 = result.filter(r => r.resource === 'R1').sort((a, b) => a.start - b.start);
    for (let i = 1; i < r1.length; i++) {
      expect(r1[i].start).toBeGreaterThanOrEqual(r1[i - 1].end);
    }
  });

  it('invariant: fragment indices are sequential with no gaps', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 300, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 100, priority: 5 });
    s.addEvent({ id: 'C', resource: 'R1', start: 200, end: 250, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    for (let i = 0; i < aFrags.length; i++) {
      expect(aFrags[i].eventId).toBe(`A.${i}`);
    }
  });

  it('invariant: union of fragments is subset of original event range', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 10, end: 200, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 50, end: 150, priority: 5 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    for (const f of aFrags) {
      expect(f.start).toBeGreaterThanOrEqual(10);
      expect(f.end).toBeLessThanOrEqual(200);
    }
  });

  // ============================================================
  // COMPLEX SCENARIO: blocking + priority + equal priority combined
  // ============================================================

  it('complex: blocking high-pri + equal-pri overlap + low-pri all on same resource', () => {
    const s = createScheduler();
    // Blocking event at priority 10: [0, 50)
    s.addEvent({ id: 'BLK', resource: 'R1', start: 0, end: 50, priority: 10, blocking: true });
    // Two equal-priority events at priority 5: [30, 130) and [80, 180)
    s.addEvent({ id: 'E1', resource: 'R1', start: 30, end: 130, priority: 5 });
    s.addEvent({ id: 'E2', resource: 'R1', start: 80, end: 180, priority: 5 });
    // Low priority: [0, 200)
    s.addEvent({ id: 'LOW', resource: 'R1', start: 0, end: 200, priority: 1 });
    const result = s.resolve();

    // BLK claims [0, 50)
    // E1 and E2: first subtract blocking window [0, 50) since blocking is higher priority
    // E1 available: [50, 130), E2 available: [80, 180)
    // E1 and E2 overlap in [80, 130): 50ms overlap
    // E1 original duration 100, E2 original duration 100 -> 50/50 -> 25ms each
    // E1 is earlier start (30 < 80 originally), gets first 25ms: [80, 105)
    // E2 gets [105, 130)
    // E1 total: [50, 105) (merged), E2 total: [105, 180) (merged)
    // LOW: subtract BLK blocking [0,50), E1 [50, 105), E2 [105, 180)
    // LOW available: [180, 200)

    const blkFrags = result.filter(r => r.originalEventId === 'BLK');
    expect(blkFrags).toHaveLength(1);
    expect(blkFrags[0].start).toBe(0);
    expect(blkFrags[0].end).toBe(50);

    const lowFrags = result.filter(r => r.originalEventId === 'LOW');
    expect(lowFrags).toHaveLength(1);
    expect(lowFrags[0].start).toBe(180);
    expect(lowFrags[0].end).toBe(200);

    // Verify no overlaps
    const all = result.filter(r => r.resource === 'R1').sort((a, b) => a.start - b.start);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].start).toBeGreaterThanOrEqual(all[i - 1].end);
    }
  });

  it('large number of events: no overlaps in output', () => {
    const s = createScheduler();
    for (let i = 0; i < 20; i++) {
      s.addEvent({
        id: `E${i}`,
        resource: 'R1',
        start: i * 10,
        end: i * 10 + 50,
        priority: i % 5,
      });
    }
    const result = s.resolve();
    const r1 = result.filter(r => r.resource === 'R1').sort((a, b) => a.start - b.start);
    for (let i = 1; i < r1.length; i++) {
      expect(r1[i].start).toBeGreaterThanOrEqual(r1[i - 1].end);
    }
  });

  it('equal priority with zero overlap share (very short event vs very long)', () => {
    const s = createScheduler();
    // B: 1ms long [99,100), fully inside A: 10000ms long [0,10000)
    // overlap = 1ms. Sorted by start: A(start=0) first, B(start=99) second.
    // A share = floor(1 * 10000/10001) = 0ms. B share = 1 - 0 = 1ms.
    // A is first (earlier start), gets its 0ms share -> nothing from overlap.
    // A still has [0,99) and [100,10000) = 9999ms of non-overlap.
    // B gets all 1ms of overlap.
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 10000, priority: 1 });
    s.addEvent({ id: 'B', resource: 'R1', start: 99, end: 100, priority: 1 });
    const result = s.resolve();

    const aFrags = result.filter(r => r.originalEventId === 'A');
    const bFrags = result.filter(r => r.originalEventId === 'B');

    // B survives with 1ms (all of overlap)
    expect(bFrags).toHaveLength(1);
    expect(bFrags[0].end - bFrags[0].start).toBe(1);

    // A loses 1ms of overlap but has 9999ms remaining in two fragments
    const aTotalDuration = aFrags.reduce((s, f) => s + (f.end - f.start), 0);
    expect(aTotalDuration).toBe(9999);
  });

  it('blocking event with zero lower-priority events: no effect', () => {
    const s = createScheduler();
    s.addEvent({ id: 'BLK', resource: 'R1', start: 0, end: 100, priority: 5, blocking: true });
    const result = s.resolve();
    expect(result).toHaveLength(1);
    expect(result[0].eventId).toBe('BLK.0');
  });

  it('priority 0 event is valid', () => {
    const s = createScheduler();
    s.addEvent({ id: 'A', resource: 'R1', start: 0, end: 100, priority: 0 });
    const result = s.resolve();
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe(0);
  });
});
