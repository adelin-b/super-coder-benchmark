export interface TaskDef {
  id: string;
  priority: number;
  dependencies: string[];
  resourceCost: number;
  durationMs: number;
}

export interface ScheduleEntry {
  taskId: string;
  startTime: number;
  endTime: number;
  resourcesUsed: number;
}

export interface ScheduleResult {
  entries: ScheduleEntry[];
  makespan: number;
  order: string[];
}

export class SchedulerError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SchedulerError';
  }
}

export function createScheduler(config: {
  maxConcurrency: number;
  totalResources: number;
}) {
  if (config.maxConcurrency < 1) throw new SchedulerError('maxConcurrency must be >= 1');
  if (config.totalResources < 1) throw new SchedulerError('totalResources must be >= 1');

  const tasks = new Map<string, TaskDef>();

  return {
    addTask(task: TaskDef): void {
      if (!task.id || typeof task.id !== 'string') throw new SchedulerError('Task id must be non-empty');
      if (tasks.has(task.id)) throw new SchedulerError(`Duplicate task ID: ${task.id}`);
      if (task.priority < 0) throw new SchedulerError('priority must be >= 0');
      if (task.resourceCost < 1) throw new SchedulerError('resourceCost must be >= 1');
      if (task.resourceCost > config.totalResources) throw new SchedulerError('resourceCost exceeds totalResources');
      if (task.durationMs <= 0) throw new SchedulerError('durationMs must be > 0');
      tasks.set(task.id, { ...task, dependencies: [...task.dependencies] });
    },

    validate(): string[] {
      const issues: string[] = [];
      for (const [id, task] of tasks) {
        for (const dep of task.dependencies) {
          if (dep === id) issues.push(`Task ${id} has self-dependency`);
          if (!tasks.has(dep)) issues.push(`Task ${id} depends on non-existent task ${dep}`);
        }
      }
      const cycle = this.detectCycle();
      if (cycle) issues.push(`Cycle detected: ${cycle.join(' -> ')}`);
      return issues;
    },

    detectCycle(): string[] | null {
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = new Map<string, number>();
      const parent = new Map<string, string | null>();

      for (const id of tasks.keys()) color.set(id, WHITE);

      for (const startId of tasks.keys()) {
        if (color.get(startId) !== WHITE) continue;

        const stack: { id: string; depIdx: number }[] = [{ id: startId, depIdx: 0 }];
        color.set(startId, GRAY);
        parent.set(startId, null);

        while (stack.length > 0) {
          const frame = stack[stack.length - 1];
          const task = tasks.get(frame.id)!;

          if (frame.depIdx < task.dependencies.length) {
            const dep = task.dependencies[frame.depIdx];
            frame.depIdx++;

            if (!tasks.has(dep)) continue;

            const depColor = color.get(dep)!;
            if (depColor === GRAY) {
              // Found cycle: reconstruct
              const cycle: string[] = [dep];
              let cur = frame.id;
              while (cur !== dep) {
                cycle.push(cur);
                cur = parent.get(cur)!;
              }
              cycle.push(dep);
              cycle.reverse();
              return cycle;
            } else if (depColor === WHITE) {
              color.set(dep, GRAY);
              parent.set(dep, frame.id);
              stack.push({ id: dep, depIdx: 0 });
            }
          } else {
            color.set(frame.id, BLACK);
            stack.pop();
          }
        }
      }
      return null;
    },

    schedule(): ScheduleResult {
      const cycle = this.detectCycle();
      if (cycle) throw new SchedulerError(`Graph has cycle: ${cycle.join(' -> ')}`);

      if (tasks.size === 0) return { entries: [], makespan: 0, order: [] };

      const entries: ScheduleEntry[] = [];
      const completed = new Set<string>();
      const scheduled = new Set<string>();
      const running: { taskId: string; endTime: number; resourceCost: number }[] = [];
      const readySkipCount = new Map<string, number>();

      let currentTime = 0;
      let maxPriority = 0;
      for (const t of tasks.values()) {
        if (t.priority > maxPriority) maxPriority = t.priority;
      }

      while (completed.size < tasks.size) {
        // Complete tasks that finish at currentTime
        const finishing = running.filter(r => r.endTime <= currentTime);
        for (const f of finishing) {
          completed.add(f.taskId);
        }
        // Remove finished from running
        const stillRunning = running.filter(r => r.endTime > currentTime);
        running.length = 0;
        running.push(...stillRunning);

        // Find ready tasks
        const ready: TaskDef[] = [];
        for (const [id, task] of tasks) {
          if (scheduled.has(id)) continue;
          const depsReady = task.dependencies.every(d => completed.has(d));
          if (depsReady) ready.push(task);
        }

        // Apply starvation boost
        const effectivePriority = new Map<string, number>();
        for (const t of ready) {
          const skipped = readySkipCount.get(t.id) || 0;
          effectivePriority.set(t.id, skipped > 3 ? maxPriority + 1 : t.priority);
        }

        // Sort by effective priority desc, then ID asc
        ready.sort((a, b) => {
          const pa = effectivePriority.get(a.id)!;
          const pb = effectivePriority.get(b.id)!;
          if (pb !== pa) return pb - pa;
          return a.id.localeCompare(b.id);
        });

        let usedResources = running.reduce((sum, r) => sum + r.resourceCost, 0);
        let runningCount = running.length;
        let scheduledThisRound = false;

        for (const task of ready) {
          if (runningCount >= config.maxConcurrency) break;
          if (usedResources + task.resourceCost > config.totalResources) continue;

          // Schedule this task
          const entry: ScheduleEntry = {
            taskId: task.id,
            startTime: currentTime,
            endTime: currentTime + task.durationMs,
            resourcesUsed: task.resourceCost,
          };
          entries.push(entry);
          running.push({ taskId: task.id, endTime: entry.endTime, resourceCost: task.resourceCost });
          scheduled.add(task.id);
          usedResources += task.resourceCost;
          runningCount++;
          scheduledThisRound = true;
          readySkipCount.delete(task.id);
        }

        // Track skipped ready tasks
        for (const task of ready) {
          if (!scheduled.has(task.id)) {
            readySkipCount.set(task.id, (readySkipCount.get(task.id) || 0) + 1);
          }
        }

        if (!scheduledThisRound && running.length > 0) {
          // Advance to next completion
          const nextEnd = Math.min(...running.map(r => r.endTime));
          currentTime = nextEnd;
        } else if (!scheduledThisRound && running.length === 0) {
          // Shouldn't happen if no cycles, but safety
          break;
        }
      }

      // Sort entries by start time, then priority desc, then ID asc
      entries.sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime - b.startTime;
        const pa = tasks.get(a.taskId)!.priority;
        const pb = tasks.get(b.taskId)!.priority;
        if (pb !== pa) return pb - pa;
        return a.taskId.localeCompare(b.taskId);
      });

      const makespan = entries.length > 0 ? Math.max(...entries.map(e => e.endTime)) : 0;
      const order = entries.map(e => e.taskId);

      return { entries, makespan, order };
    },

    criticalPath(): string[] {
      if (tasks.size === 0) return [];

      // Longest path by duration using dynamic programming
      const memo = new Map<string, { length: number; path: string[] }>();

      function longest(id: string): { length: number; path: string[] } {
        if (memo.has(id)) return memo.get(id)!;
        const task = tasks.get(id)!;
        let bestDep: { length: number; path: string[] } = { length: 0, path: [] };

        for (const dep of task.dependencies) {
          if (!tasks.has(dep)) continue;
          const depResult = longest(dep);
          if (depResult.length > bestDep.length ||
              (depResult.length === bestDep.length && depResult.path.length > 0)) {
            bestDep = depResult;
          }
        }

        const result = {
          length: bestDep.length + task.durationMs,
          path: [...bestDep.path, id],
        };
        memo.set(id, result);
        return result;
      }

      let best: { length: number; path: string[] } = { length: 0, path: [] };
      for (const id of tasks.keys()) {
        const result = longest(id);
        if (result.length > best.length) {
          best = result;
        }
      }

      return best.path;
    },

    topologicalOrder(): string[] {
      const inDegree = new Map<string, number>();
      for (const id of tasks.keys()) inDegree.set(id, 0);
      for (const task of tasks.values()) {
        for (const dep of task.dependencies) {
          if (tasks.has(dep)) {
            // task depends on dep, so task has an incoming edge from dep
            // We want: dep before task. So inDegree counts dependencies.
          }
        }
      }
      // inDegree[id] = number of dependencies that are in the graph
      for (const task of tasks.values()) {
        let count = 0;
        for (const dep of task.dependencies) {
          if (tasks.has(dep)) count++;
        }
        inDegree.set(task.id, count);
      }

      // Priority queue (sorted array approach)
      const result: string[] = [];
      const available: string[] = [];

      for (const [id, deg] of inDegree) {
        if (deg === 0) available.push(id);
      }

      while (available.length > 0) {
        // Sort: highest priority first, then lexicographic ID
        available.sort((a, b) => {
          const pa = tasks.get(a)!.priority;
          const pb = tasks.get(b)!.priority;
          if (pb !== pa) return pb - pa;
          return a.localeCompare(b);
        });

        const next = available.shift()!;
        result.push(next);

        // Reduce in-degree for tasks that depend on `next`
        for (const [id, task] of tasks) {
          if (task.dependencies.includes(next)) {
            const newDeg = inDegree.get(id)! - 1;
            inDegree.set(id, newDeg);
            if (newDeg === 0) available.push(id);
          }
        }
      }

      return result;
    },
  };
}
