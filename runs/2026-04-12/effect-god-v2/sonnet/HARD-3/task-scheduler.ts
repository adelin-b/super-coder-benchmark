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
  constructor(message: string) {
    super(message);
    this.name = "SchedulerError";
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
      throw new Error(`Duplicate task ID: "${task.id}"`);
    }
    tasks.set(task.id, task);
  }

  function validate(): string[] {
    const issues: string[] = [];

    if (config.maxConcurrency < 1) {
      issues.push(
        `maxConcurrency must be >= 1, got ${config.maxConcurrency}`
      );
    }
    if (config.totalResources < 1) {
      issues.push(
        `totalResources must be >= 1, got ${config.totalResources}`
      );
    }

    for (const task of tasks.values()) {
      if (!task.id || task.id.trim() === "") {
        issues.push(`Task has an empty or missing ID`);
      }
      if (task.priority < 0) {
        issues.push(
          `Task "${task.id}": priority must be >= 0, got ${task.priority}`
        );
      }
      if (task.resourceCost < 1) {
        issues.push(
          `Task "${task.id}": resourceCost must be >= 1, got ${task.resourceCost}`
        );
      } else if (task.resourceCost > config.totalResources) {
        issues.push(
          `Task "${task.id}": resourceCost ${task.resourceCost} exceeds totalResources ${config.totalResources}`
        );
      }
      if (task.durationMs <= 0) {
        issues.push(
          `Task "${task.id}": durationMs must be > 0, got ${task.durationMs}`
        );
      }
      for (const dep of task.dependencies) {
        if (dep === task.id) {
          issues.push(`Task "${task.id}": has a self-dependency`);
        } else if (!tasks.has(dep)) {
          issues.push(
            `Task "${task.id}": dependency "${dep}" does not exist`
          );
        }
      }
    }

    return issues;
  }

  function detectCycle(): string[] | null {
    type NodeState = "unvisited" | "in-stack" | "done";
    const state = new Map<string, NodeState>();
    const stack: string[] = [];

    for (const id of tasks.keys()) {
      state.set(id, "unvisited");
    }

    function dfs(id: string): string[] | null {
      state.set(id, "in-stack");
      stack.push(id);

      const task = tasks.get(id)!;
      for (const dep of task.dependencies) {
        if (!tasks.has(dep)) continue;

        if (state.get(dep) === "in-stack") {
          const idx = stack.indexOf(dep);
          const cycle = stack.slice(idx);
          cycle.push(dep);
          return cycle;
        }

        if (state.get(dep) === "unvisited") {
          const result = dfs(dep);
          if (result !== null) return result;
        }
      }

      stack.pop();
      state.set(id, "done");
      return null;
    }

    for (const id of tasks.keys()) {
      if (state.get(id) === "unvisited") {
        const result = dfs(id);
        if (result !== null) return result;
      }
    }

    return null;
  }

  function topologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const id of tasks.keys()) {
      inDegree.set(id, 0);
      dependents.set(id, []);
    }

    for (const task of tasks.values()) {
      for (const dep of task.dependencies) {
        if (tasks.has(dep)) {
          inDegree.set(task.id, inDegree.get(task.id)! + 1);
          dependents.get(dep)!.push(task.id);
        }
      }
    }

    const sortFn = (a: string, b: string): number => {
      const pa = tasks.get(a)!.priority;
      const pb = tasks.get(b)!.priority;
      if (pb !== pa) return pb - pa;
      return a.localeCompare(b);
    };

    let queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    queue.sort(sortFn);

    const result: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);

      const newReady: string[] = [];
      for (const child of dependents.get(id)!) {
        const newDeg = inDegree.get(child)! - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0) newReady.push(child);
      }

      newReady.sort(sortFn);
      queue = [...queue, ...newReady].sort(sortFn);
    }

    return result;
  }

  function criticalPath(): string[] {
    type PathInfo = { length: number; path: string[] };
    const dp = new Map<string, PathInfo>();

    function pathBetter(a: PathInfo, b: PathInfo): boolean {
      if (a.length !== b.length) return a.length > b.length;
      if (a.path.length === 0 && b.path.length === 0) return false;
      if (a.path.length === 0) return false;
      if (b.path.length === 0) return true;
      // Tie-break: first (root) task in path has higher priority
      const priA = tasks.get(a.path[0])!.priority;
      const priB = tasks.get(b.path[0])!.priority;
      return priA > priB;
    }

    function compute(id: string): PathInfo {
      if (dp.has(id)) return dp.get(id)!;

      const task = tasks.get(id)!;
      let bestPred: PathInfo = { length: 0, path: [] };

      for (const dep of task.dependencies) {
        if (!tasks.has(dep)) continue;
        const sub = compute(dep);
        if (pathBetter(sub, bestPred)) {
          bestPred = sub;
        }
      }

      const result: PathInfo = {
        length: bestPred.length + task.durationMs,
        path: [...bestPred.path, id],
      };
      dp.set(id, result);
      return result;
    }

    for (const id of tasks.keys()) {
      compute(id);
    }

    let best: PathInfo = { length: 0, path: [] };
    for (const val of dp.values()) {
      if (pathBetter(val, best)) {
        best = val;
      }
    }

    return best.path;
  }

  function schedule(): ScheduleResult {
    const cycle = detectCycle();
    if (cycle !== null) {
      throw new SchedulerError(
        `Cycle detected in task graph: ${cycle.join(" -> ")}`
      );
    }

    if (tasks.size === 0) {
      return { entries: [], makespan: 0, order: [] };
    }

    const entries: ScheduleEntry[] = [];
    const completed = new Set<string>();
    const started = new Set<string>();

    type Running = { taskId: string; endTime: number; resourceCost: number };
    let running: Running[] = [];

    let currentTime = 0;
    const roundsSkipped = new Map<string, number>();
    for (const id of tasks.keys()) {
      roundsSkipped.set(id, 0);
    }

    const allTaskIds = Array.from(tasks.keys());

    while (started.size < allTaskIds.length) {
      // Determine the max priority across all tasks for anti-starvation boost
      let maxPriority = 0;
      for (const t of tasks.values()) {
        if (t.priority > maxPriority) maxPriority = t.priority;
      }

      // Find all ready tasks: not started, all deps complete (or non-existent)
      const readyTasks = allTaskIds.filter((id) => {
        if (started.has(id)) return false;
        const task = tasks.get(id)!;
        return task.dependencies.every(
          (dep) => !tasks.has(dep) || completed.has(dep)
        );
      });

      // Sort ready tasks: anti-starvation boosted tasks first, then by effective
      // priority desc, then by ID asc
      readyTasks.sort((a, b) => {
        const skA = roundsSkipped.get(a) ?? 0;
        const skB = roundsSkipped.get(b) ?? 0;
        const effA = skA > 3 ? maxPriority + 1 : tasks.get(a)!.priority;
        const effB = skB > 3 ? maxPriority + 1 : tasks.get(b)!.priority;
        if (effB !== effA) return effB - effA;
        return a.localeCompare(b);
      });

      // Compute current resource and concurrency usage from running tasks
      let usedResources = 0;
      for (const r of running) usedResources += r.resourceCost;
      let usedConcurrency = running.length;

      const scheduledThisRound = new Set<string>();

      // Greedily schedule ready tasks in priority order
      for (const id of readyTasks) {
        const task = tasks.get(id)!;
        if (
          usedConcurrency < config.maxConcurrency &&
          usedResources + task.resourceCost <= config.totalResources
        ) {
          const startTime = currentTime;
          const endTime = startTime + task.durationMs;

          entries.push({
            taskId: id,
            startTime,
            endTime,
            resourcesUsed: task.resourceCost,
          });

          started.add(id);
          running.push({ taskId: id, endTime, resourceCost: task.resourceCost });
          scheduledThisRound.add(id);
          usedResources += task.resourceCost;
          usedConcurrency++;
          roundsSkipped.set(id, 0);
        }
      }

      // Increment rounds-skipped counter for ready tasks not scheduled this round
      for (const id of readyTasks) {
        if (!scheduledThisRound.has(id)) {
          roundsSkipped.set(id, (roundsSkipped.get(id) ?? 0) + 1);
        }
      }

      // Advance time: we always need to move forward to the next completion event
      if (running.length === 0) {
        // No running tasks and nothing was scheduled — deadlock/stuck
        // (valid input + cycle-free graph should never reach here)
        break;
      }

      const earliestEnd = running.reduce(
        (min, r) => (r.endTime < min ? r.endTime : min),
        Infinity
      );
      currentTime = earliestEnd;

      // Mark tasks that complete at or before currentTime as completed
      for (const r of running) {
        if (r.endTime <= currentTime) {
          completed.add(r.taskId);
        }
      }
      running = running.filter((r) => r.endTime > currentTime);
    }

    const makespan =
      entries.length > 0 ? Math.max(...entries.map((e) => e.endTime)) : 0;

    // Build order: sort entries by startTime asc, ties broken by priority desc, then ID asc
    const order = [...entries]
      .sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime - b.startTime;
        const pa = tasks.get(a.taskId)!.priority;
        const pb = tasks.get(b.taskId)!.priority;
        if (pb !== pa) return pb - pa;
        return a.taskId.localeCompare(b.taskId);
      })
      .map((e) => e.taskId);

    return { entries, makespan, order };
  }

  return { addTask, validate, detectCycle, schedule, criticalPath, topologicalOrder };
}