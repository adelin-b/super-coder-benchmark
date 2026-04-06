import { describe, it, expect } from 'vitest';
import { createScheduler, SchedulerError } from './task-scheduler.js';

describe('HARD-3: Dependency-Aware Task Scheduler', () => {
  // --- Basic scheduling ---
  it('schedules a single task', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    const result = s.schedule();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].startTime).toBe(0);
    expect(result.entries[0].endTime).toBe(100);
    expect(result.makespan).toBe(100);
    expect(result.order).toEqual(['A']);
  });

  it('schedules independent tasks in parallel by priority', () => {
    const s = createScheduler({ maxConcurrency: 3, totalResources: 10 });
    s.addTask({ id: 'A', priority: 5, dependencies: [], resourceCost: 2, durationMs: 100 });
    s.addTask({ id: 'B', priority: 10, dependencies: [], resourceCost: 2, durationMs: 200 });
    s.addTask({ id: 'C', priority: 1, dependencies: [], resourceCost: 2, durationMs: 50 });
    const result = s.schedule();
    // All start at 0 (enough concurrency and resources)
    expect(result.entries.every(e => e.startTime === 0)).toBe(true);
    expect(result.makespan).toBe(200);
    // Order: B (pri 10), A (pri 5), C (pri 1)
    expect(result.order).toEqual(['B', 'A', 'C']);
  });

  it('respects dependency ordering', () => {
    const s = createScheduler({ maxConcurrency: 5, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['B'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: [], resourceCost: 1, durationMs: 200 });
    const result = s.schedule();
    const bEntry = result.entries.find(e => e.taskId === 'B')!;
    const aEntry = result.entries.find(e => e.taskId === 'A')!;
    expect(bEntry.startTime).toBe(0);
    expect(aEntry.startTime).toBeGreaterThanOrEqual(bEntry.endTime);
    expect(result.makespan).toBe(300);
  });

  // --- Diamond dependencies ---
  it('handles diamond dependencies correctly', () => {
    const s = createScheduler({ maxConcurrency: 4, totalResources: 10 });
    s.addTask({ id: 'D', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 2, dependencies: ['D'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'C', priority: 2, dependencies: ['D'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'A', priority: 3, dependencies: ['B', 'C'], resourceCost: 1, durationMs: 100 });
    const result = s.schedule();
    const dEnd = result.entries.find(e => e.taskId === 'D')!.endTime;
    const bStart = result.entries.find(e => e.taskId === 'B')!.startTime;
    const cStart = result.entries.find(e => e.taskId === 'C')!.startTime;
    const aStart = result.entries.find(e => e.taskId === 'A')!.startTime;
    expect(bStart).toBeGreaterThanOrEqual(dEnd);
    expect(cStart).toBeGreaterThanOrEqual(dEnd);
    // B and C can run in parallel
    expect(bStart).toBe(cStart);
    expect(aStart).toBeGreaterThanOrEqual(result.entries.find(e => e.taskId === 'B')!.endTime);
    expect(aStart).toBeGreaterThanOrEqual(result.entries.find(e => e.taskId === 'C')!.endTime);
    expect(result.makespan).toBe(300); // D:100 + B|C:100 + A:100
  });

  // --- Resource constraints ---
  it('respects resource limits (task waits for resources)', () => {
    const s = createScheduler({ maxConcurrency: 10, totalResources: 3 });
    s.addTask({ id: 'A', priority: 5, dependencies: [], resourceCost: 2, durationMs: 100 });
    s.addTask({ id: 'B', priority: 4, dependencies: [], resourceCost: 2, durationMs: 100 });
    s.addTask({ id: 'C', priority: 3, dependencies: [], resourceCost: 2, durationMs: 100 });
    const result = s.schedule();
    // A(2) starts at 0, B(2) can't fit (2+2=4>3), so B waits
    const aEntry = result.entries.find(e => e.taskId === 'A')!;
    const bEntry = result.entries.find(e => e.taskId === 'B')!;
    expect(aEntry.startTime).toBe(0);
    expect(bEntry.startTime).toBeGreaterThanOrEqual(aEntry.endTime);
  });

  it('task using all resources must run alone', () => {
    const s = createScheduler({ maxConcurrency: 10, totalResources: 5 });
    s.addTask({ id: 'big', priority: 5, dependencies: [], resourceCost: 5, durationMs: 100 });
    s.addTask({ id: 'small', priority: 10, dependencies: [], resourceCost: 1, durationMs: 50 });
    const result = s.schedule();
    // small has higher priority, starts first
    const smallEntry = result.entries.find(e => e.taskId === 'small')!;
    const bigEntry = result.entries.find(e => e.taskId === 'big')!;
    // small starts at 0, big can't fit alongside small (1+5=6>5), so big waits
    // Actually: small(1) + big(5) = 6 > 5, so big waits for small
    expect(smallEntry.startTime).toBe(0);
    expect(bigEntry.startTime).toBeGreaterThanOrEqual(smallEntry.endTime);
  });

  // --- Concurrency limits ---
  it('respects maxConcurrency', () => {
    const s = createScheduler({ maxConcurrency: 1, totalResources: 100 });
    s.addTask({ id: 'A', priority: 2, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    const result = s.schedule();
    // Only 1 at a time: A (higher priority) first, then B
    expect(result.entries[0].taskId).toBe('A');
    expect(result.entries[1].startTime).toBe(100);
    expect(result.makespan).toBe(200);
  });

  // --- Cycle detection ---
  it('detects simple cycle', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['B'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: ['A'], resourceCost: 1, durationMs: 100 });
    const cycle = s.detectCycle();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3); // A->B->A or B->A->B
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]); // cycle
  });

  it('detectCycle returns null for valid DAG', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['B'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    expect(s.detectCycle()).toBeNull();
  });

  it('schedule throws on cycles', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['B'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: ['C'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'C', priority: 1, dependencies: ['A'], resourceCost: 1, durationMs: 100 });
    expect(() => s.schedule()).toThrow(SchedulerError);
  });

  // --- Anti-starvation ---
  it('low priority task gets boosted after being skipped (anti-starvation)', () => {
    const s = createScheduler({ maxConcurrency: 1, totalResources: 10 });
    // 5 high priority short tasks, then 1 low priority
    s.addTask({ id: 'H1', priority: 100, dependencies: [], resourceCost: 1, durationMs: 10 });
    s.addTask({ id: 'H2', priority: 100, dependencies: ['H1'], resourceCost: 1, durationMs: 10 });
    s.addTask({ id: 'H3', priority: 100, dependencies: ['H2'], resourceCost: 1, durationMs: 10 });
    s.addTask({ id: 'H4', priority: 100, dependencies: ['H3'], resourceCost: 1, durationMs: 10 });
    s.addTask({ id: 'L1', priority: 1, dependencies: [], resourceCost: 1, durationMs: 10 });
    const result = s.schedule();
    // L1 is ready from the start but skipped due to lower priority
    // After being skipped >3 rounds, it gets boosted
    // Verify L1 eventually runs
    expect(result.entries.find(e => e.taskId === 'L1')).toBeDefined();
    // L1 should start before all high-priority chain completes (it gets boosted)
    const l1Start = result.entries.find(e => e.taskId === 'L1')!.startTime;
    const h4End = result.entries.find(e => e.taskId === 'H4')!.endTime;
    expect(l1Start).toBeLessThan(h4End);
  });

  // --- Critical path ---
  it('finds critical path through longest duration chain', () => {
    const s = createScheduler({ maxConcurrency: 4, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 1, dependencies: ['A'], resourceCost: 1, durationMs: 200 });
    s.addTask({ id: 'C', priority: 1, dependencies: ['A'], resourceCost: 1, durationMs: 50 });
    s.addTask({ id: 'D', priority: 1, dependencies: ['B', 'C'], resourceCost: 1, durationMs: 100 });
    const cp = s.criticalPath();
    // A(100) -> B(200) -> D(100) = 400 vs A(100) -> C(50) -> D(100) = 250
    expect(cp).toEqual(['A', 'B', 'D']);
  });

  // --- Topological order ---
  it('topological order respects dependencies and prefers higher priority', () => {
    const s = createScheduler({ maxConcurrency: 4, totalResources: 10 });
    s.addTask({ id: 'C', priority: 1, dependencies: ['A', 'B'], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'A', priority: 5, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'B', priority: 3, dependencies: [], resourceCost: 1, durationMs: 100 });
    const order = s.topologicalOrder();
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
    // A (pri 5) should come before B (pri 3)
    expect(order[0]).toBe('A');
    expect(order[1]).toBe('B');
    expect(order[2]).toBe('C');
  });

  // --- Validation ---
  it('throws on duplicate task ID', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: [], resourceCost: 1, durationMs: 100 });
    expect(() => s.addTask({ id: 'A', priority: 2, dependencies: [], resourceCost: 1, durationMs: 100 }))
      .toThrow(SchedulerError);
  });

  it('validate detects self-dependency', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['A'], resourceCost: 1, durationMs: 100 });
    const issues = s.validate();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.includes('self'))).toBe(true);
  });

  it('validate detects non-existent dependency', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    s.addTask({ id: 'A', priority: 1, dependencies: ['Z'], resourceCost: 1, durationMs: 100 });
    const issues = s.validate();
    expect(issues.some(i => i.includes('non-existent'))).toBe(true);
  });

  it('throws on invalid config', () => {
    expect(() => createScheduler({ maxConcurrency: 0, totalResources: 10 })).toThrow(SchedulerError);
    expect(() => createScheduler({ maxConcurrency: 1, totalResources: 0 })).toThrow(SchedulerError);
  });

  it('throws on resourceCost exceeding totalResources', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 5 });
    expect(() => s.addTask({ id: 'A', priority: 1, dependencies: [], resourceCost: 6, durationMs: 100 }))
      .toThrow(SchedulerError);
  });

  // --- Empty graph ---
  it('schedules empty graph', () => {
    const s = createScheduler({ maxConcurrency: 2, totalResources: 10 });
    const result = s.schedule();
    expect(result.entries).toHaveLength(0);
    expect(result.makespan).toBe(0);
  });

  // --- Tie-breaking ---
  it('breaks priority ties by lexicographic ID', () => {
    const s = createScheduler({ maxConcurrency: 10, totalResources: 100 });
    s.addTask({ id: 'B', priority: 5, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'A', priority: 5, dependencies: [], resourceCost: 1, durationMs: 100 });
    s.addTask({ id: 'C', priority: 5, dependencies: [], resourceCost: 1, durationMs: 100 });
    const result = s.schedule();
    // All start at 0, order should be A, B, C (lexicographic for same priority and start)
    expect(result.order).toEqual(['A', 'B', 'C']);
  });
});
