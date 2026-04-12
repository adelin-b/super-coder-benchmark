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
    this.name = "SchedulerError";
    Object.setPrototypeOf(this, SchedulerError.prototype);
  }
}

export function createScheduler(config: {
  maxConcurrency: number;
  totalResources: number;
}): {
  addTask(task: TaskDef): void;
  validate(): string[];
  detectCycle(): string[] | null;
  schedule(): ScheduleResult;
  criticalPath(): string[];
  topologicalOrder(): string[];
} {
  const tasks = new Map<string, TaskDef>();

  function addTask(task: TaskDef): void {
    if (tasks.has(task.id)) {
      throw new SchedulerError(`Duplicate task ID: ${task.id}`);
    }
    tasks.set(task.id, { ...task, dependencies: [...task.dependencies] });
  }

  function validate(): string[] {
    const issues: string[] = [];
    if (config.maxConcurrency < 1) issues.push("maxConcurrency must be >= 1");
    if (config.totalResources < 1) issues.push("totalResources must be >= 1");

    for (const task of tasks.values()) {
      if (!task.id || task.id.trim() === "") {
        issues.push("Task has empty ID");
      }
      if (task.priority < 0) {
        issues.push(`Task ${task.id}: priority must be >= 0`);
      }
      if (task.resourceCost < 1) {
        issues.push(`Task ${task.id}: resourceCost must be >= 1`);
      }
      if (task.resourceCost > config.totalResources) {
        issues.push(
          `Task ${task.id}: resourceCost (${task.resourceCost}) exceeds totalResources (${config.totalResources})`
        );
      }
      if (task.durationMs <= 0) {
        issues.push(`Task ${task.id}: durationMs must be > 0`);
      }
      for (const dep of task.dependencies) {
        if (dep === task.id) {
          issues.push(`Task ${task.id}: self-dependency detected`);
        } else if (!tasks.has(dep)) {
          issues.push(`Task ${task.id}: dependency '${dep}' does not exist`);
        }
      }
    }
    return issues;
  }

  function detectCycle(): string[] | null {
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of tasks.keys()) {
      color.set(id, WHITE);
      parent.set(id, null);
    }

    let cyclePath: string[] | null = null;

    function dfs(u: string): boolean {
      color.set(u, GRAY);
      const task = tasks.get(u)!;
      for (const dep of task.dependencies) {
        if (!tasks.has(dep)) continue;
        const depColor = color.get(dep)!;
        if (depColor === GRAY) {
          // Back edge u -> dep: reconstruct cycle [dep, ..., u, dep]
          const path: string[] = [];
          let c: string = u;
          while (c !== dep) {
            path.unshift(c);
            const p = parent.get(c);
            if (p == null) break;
            c = p;
          }
          path.unshift(dep);
          path.push(dep);
          cyclePath = path;
          return true;
        }
        if (depColor === WHITE) {
          parent.set(dep, u);
          if (dfs(dep)) return true;
        }
      }
      color.set(u, BLACK);
      return false;
    }

    for (const id of tasks.keys()) {
      if (color.get(id) === WHITE) {
        if (dfs(id)) return cyclePath;
      }
    }
    return null;
  }

  function topologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of tasks.keys()) inDegree.set(id, 0);
    for (const task of tasks.values()) {
      for (const dep of task.dependencies) {
        if (tasks.has(dep)) {
          inDegree.set(task.id, inDegree.get(task.id)! + 1);
        }
      }
    }

    const sortFn = (a: string, b: string): number => {
      const pa = tasks.get(a)!.priority;
      const pb = tasks.get(b)!.priority;
      if (pb !== pa) return pb - pa;
      return a < b ? -1 : 1;
    };

    const ready: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) ready.push(id);
    }
    ready.sort(sortFn);

    const result: string[] = [];
    while (ready.length > 0) {
      const u = ready.shift()!;
      result.push(u);
      for (const task of tasks.values()) {
        if (task.dependencies.includes(u)) {
          const newDeg = inDegree.get(task.id)! - 1;
          inDegree.set(task.id, newDeg);
          if (newDeg === 0) {
            ready.push(task.id);
            ready.sort(sortFn);
          }
        }
      }
    }
    return result;
  }

  function preferPath(a: string[], b: string[]): boolean {
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] !== b[i]) {
        const pa = tasks.get(a[i])?.priority ?? -1;
        const pb = tasks.get(b[i])?.priority ?? -1;
        return pa > pb;
      }
    }
    return a.length > b.length;
  }

  function criticalPath(): string[] {
    const topoOrder = topologicalOrder();
    const dp = new Map<string, { length: number; path: string[] }>();

    for (const id of topoOrder) {
      const task = tasks.get(id)!;
      let best: { length: number; path: string[] } = {
        length: task.durationMs,
        path: [id],
      };

      for (const dep of task.dependencies) {
        const depDp = dp.get(dep);
        if (!depDp) continue;
        const candidate = depDp.length + task.durationMs;
        const candidatePath = [...depDp.path, id];
        if (candidate > best.length) {
          best = { length: candidate, path: candidatePath };
        } else if (
          candidate === best.length &&
          preferPath(candidatePath, best.path)
        ) {
          best = { length: candidate, path: candidatePath };
        }
      }
      dp.set(id, best);
    }

    let maxLen = -1;
    let maxPath: string[] = [];
    for (const dpVal of dp.values()) {
      if (
        dpVal.length > maxLen ||
        (dpVal.length === maxLen && preferPath(dpVal.path, maxPath))
      ) {
        maxLen = dpVal.length;
        maxPath = dpVal.path;
      }
    }
    return maxPath;
  }

  function schedule(): ScheduleResult {
    const cycle = detectCycle();
    if (cycle !== null) {
      throw new SchedulerError(`Cycle detected: ${cycle.join(" -> ")}`);
    }

    const taskList = Array.from(tasks.values());
    if (taskList.length === 0) {
      return { entries: [], makespan: 0, order: [] };
    }

    const entries: ScheduleEntry[] = [];
    const completed = new Set<string>();
    const started = new Set<string>();
    const skippedRounds = new Map<string, number>();
    for (const task of taskList) skippedRounds.set(task.id, 0);

    interface RunningTask {
      taskId: string;
      endTime: number;
      resourceCost: number;
    }

    let running: RunningTask[] = [];
    let currentTime = 0;

    const isReady = (task: TaskDef): boolean => {
      if (started.has(task.id)) return false;
      return task.dependencies.every((dep) => completed.has(dep));
    };

    const getMaxPriority = (): number => {
      let max = 0;
      for (const t of taskList) if (t.priority > max) max = t.priority;
      return max;
    };

    const maxIter = taskList.length * (taskList.length + 10) * 100;
    let iter = 0;

    while (started.size < taskList.length && iter < maxIter) {
      iter++;

      // Mark completed tasks
      for (const rt of running) {
        if (rt.endTime <= currentTime) completed.add(rt.taskId);
      }
      running = running.filter((rt) => rt.endTime > currentTime);

      const readyTasks = taskList.filter((t) => isReady(t));

      if (readyTasks.length === 0 && running.length === 0) break;

      if (readyTasks.length === 0) {
        currentTime = Math.min(...running.map((rt) => rt.endTime));
        continue;
      }

      const mp = getMaxPriority();
      const boostedPriority = (task: TaskDef): number => {
        return (skippedRounds.get(task.id) ?? 0) > 3 ? mp + 1 : task.priority;
      };

      readyTasks.sort((a, b) => {
        const pa = boostedPriority(a);
        const pb = boostedPriority(b);
        if (pb !== pa) return pb - pa;
        return a.id < b.id ? -1 : 1;
      });

      const usedResources = running.reduce(
        (sum, rt) => sum + rt.resourceCost,
        0
      );
      let availableResources = config.totalResources - usedResources;
      let availableConcurrency = config.maxConcurrency - running.length;

      let anyScheduled = false;
      const scheduledThisRound = new Set<string>();

      for (const task of readyTasks) {
        if (availableConcurrency <= 0) break;
        if (task.resourceCost <= availableResources) {
          const entry: ScheduleEntry = {
            taskId: task.id,
            startTime: currentTime,
            endTime: currentTime + task.durationMs,
            resourcesUsed: task.resourceCost,
          };
          entries.push(entry);
          started.add(task.id);
          running.push({
            taskId: task.id,
            endTime: entry.endTime,
            resourceCost: task.resourceCost,
          });
          availableResources -= task.resourceCost;
          availableConcurrency--;
          scheduledThisRound.add(task.id);
          skippedRounds.set(task.id, 0);
          anyScheduled = true;
        }
      }

      // Increment skipped rounds for ready-but-not-scheduled tasks
      for (const task of readyTasks) {
        if (!scheduledThisRound.has(task.id)) {
          skippedRounds.set(task.id, (skippedRounds.get(task.id) ?? 0) + 1);
        }
      }

      if (!anyScheduled) {
        if (running.length === 0) break;
        currentTime = Math.min(...running.map((rt) => rt.endTime));
        for (const rt of running) {
          if (rt.endTime <= currentTime) completed.add(rt.taskId);
        }
        running = running.filter((rt) => rt.endTime > currentTime);
      }
    }

    const makespan =
      entries.length > 0 ? Math.max(...entries.map((e) => e.endTime)) : 0;

    const sortedEntries = [...entries].sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      const pa = tasks.get(a.taskId)!.priority;
      const pb = tasks.get(b.taskId)!.priority;
      if (pb !== pa) return pb - pa;
      return a.taskId < b.taskId ? -1 : 1;
    });

    const order = sortedEntries.map((e) => e.taskId);
    return { entries, makespan, order };
  }

  return { addTask, validate, detectCycle, schedule, criticalPath, topologicalOrder };
}