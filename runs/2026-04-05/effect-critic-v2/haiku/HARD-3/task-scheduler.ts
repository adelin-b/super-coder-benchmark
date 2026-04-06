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
      throw new Error(`Task with ID ${task.id} already exists`);
    }
    tasks.set(task.id, task);
  }

  function validate(): string[] {
    const issues: string[] = [];

    if (config.maxConcurrency < 1) {
      issues.push("maxConcurrency must be >= 1");
    }
    if (config.totalResources < 1) {
      issues.push("totalResources must be >= 1");
    }

    for (const task of tasks.values()) {
      if (!task.id || task.id.trim() === "") {
        issues.push("Task id must be non-empty");
      }
      if (task.priority < 0) {
        issues.push(`Task ${task.id}: priority must be >= 0`);
      }
      if (task.resourceCost < 1 || task.resourceCost > config.totalResources) {
        issues.push(
          `Task ${task.id}: resourceCost must be >= 1 and <= totalResources`
        );
      }
      if (task.durationMs <= 0) {
        issues.push(`Task ${task.id}: durationMs must be > 0`);
      }

      for (const dep of task.dependencies) {
        if (!tasks.has(dep)) {
          issues.push(`Task ${task.id}: depends on non-existent task ${dep}`);
        }
        if (dep === task.id) {
          issues.push(`Task ${task.id}: self-dependency not allowed`);
        }
      }
    }

    return issues;
  }

  function detectCycle(): string[] | null {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();

    for (const id of tasks.keys()) {
      color.set(id, WHITE);
    }

    function dfs(node: string, path: string[]): string[] | null {
      color.set(node, GRAY);
      const task = tasks.get(node)!;

      for (const dep of task.dependencies) {
        const depColor = color.get(dep);
        if (depColor === GRAY) {
          const cycleStart = path.indexOf(dep);
          return path.slice(cycleStart).concat([dep]);
        }
        if (depColor === WHITE) {
          const result = dfs(dep, path.concat([node]));
          if (result) return result;
        }
      }

      color.set(node, BLACK);
      return null;
    }

    for (const id of tasks.keys()) {
      if (color.get(id) === WHITE) {
        const result = dfs(id, []);
        if (result) return result;
      }
    }

    return null;
  }

  function schedule(): ScheduleResult {
    const cycle = detectCycle();
    if (cycle) {
      throw new SchedulerError(`Cycle detected: ${cycle.join(" -> ")}`);
    }

    const entries: ScheduleEntry[] = [];
    const scheduled = new Set<string>();
    const completed = new Set<string>();
    const running = new Map<
      string,
      { endTime: number; resourceCost: number }
    >();
    const readyRounds = new Map<string, number>();
    let currentTime = 0;
    let schedulingRound = 0;

    while (scheduled.size < tasks.size) {
      schedulingRound++;

      // Mark tasks as completed if their end time has passed
      const toComplete: string[] = [];
      for (const [taskId, info] of running) {
        if (info.endTime <= currentTime) {
          toComplete.push(taskId);
          completed.add(taskId);
        }
      }
      for (const taskId of toComplete) {
        running.delete(taskId);
      }

      // Find ready tasks (deps met, not yet scheduled)
      const ready: string[] = [];
      for (const [taskId, task] of tasks) {
        if (scheduled.has(taskId)) continue;
        const allDepsComplete = task.dependencies.every((dep) =>
          completed.has(dep)
        );
        if (allDepsComplete) {
          ready.push(taskId);
        }
      }

      // Calculate remaining resources and slots
      const usedResources = Array.from(running.values()).reduce(
        (sum, r) => sum + r.resourceCost,
        0
      );
      let remainingResources = config.totalResources - usedResources;
      let runningCount = running.size;

      // Sort ready tasks by priority (desc), then ID (asc)
      // Apply anti-starvation boost
      const maxPriority = Math.max(...tasks.values().map((t) => t.priority), 0);

      ready.sort((a, b) => {
        const taskA = tasks.get(a)!;
        const taskB = tasks.get(b)!;
        const roundsA = readyRounds.get(a) || 0;
        const roundsB = readyRounds.get(b) || 0;
        const priorityA =
          roundsA >= 3 ? maxPriority + 1 : taskA.priority;
        const priorityB =
          roundsB >= 3 ? maxPriority + 1 : taskB.priority;

        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        return a.localeCompare(b);
      });

      // Try to schedule ready tasks
      let scheduledAny = false;
      for (const taskId of ready) {
        const task = tasks.get(taskId)!;
        if (
          runningCount < config.maxConcurrency &&
          task.resourceCost <= remainingResources
        ) {
          const startTime = currentTime;
          const endTime = currentTime + task.durationMs;
          entries.push({
            taskId,
            startTime,
            endTime,
            resourcesUsed: task.resourceCost,
          });
          scheduled.add(taskId);
          running.set(taskId, {
            endTime,
            resourceCost: task.resourceCost,
          });
          remainingResources -= task.resourceCost;
          runningCount++;
          scheduledAny = true;
          readyRounds.delete(taskId);
        } else {
          // Couldn't schedule, increment skip counter
          const skipped = readyRounds.get(taskId) || 0;
          readyRounds.set(taskId, skipped + 1);
        }
      }

      // If nothing scheduled and still pending, advance time
      if (!scheduledAny && scheduled.size < tasks.size) {
        if (running.size > 0) {
          const nextTime = Math.min(
            ...Array.from(running.values()).map((r) => r.endTime)
          );
          currentTime = nextTime;
        } else {
          // Deadlock or error - shouldn't happen in valid DAG
          break;
        }
      }

      // Safety limit
      if (schedulingRound > tasks.size * 1000) break;
    }

    // Build result
    const makespan =
      entries.length > 0 ? Math.max(...entries.map((e) => e.endTime)) : 0;

    const order = entries
      .sort((a, b) => {
        if (a.startTime !== b.startTime) {
          return a.startTime - b.startTime;
        }
        const taskA = tasks.get(a.taskId)!;
        const taskB = tasks.get(b.taskId)!;
        if (taskA.priority !== taskB.priority) {
          return taskB.priority - taskA.priority;
        }
        return a.taskId.localeCompare(b.taskId);
      })
      .map((e) => e.taskId);

    return { entries, makespan, order };
  }

  function criticalPath(): string[] {
    // Compute longest path by duration sum
    const memo = new Map<string, { length: number; path: string[] }>();

    function computePath(taskId: string): { length: number; path: string[] } {
      if (memo.has(taskId)) {
        return memo.get(taskId)!;
      }

      const task = tasks.get(taskId)!;

      if (task.dependencies.length === 0) {
        memo.set(taskId, {
          length: task.durationMs,
          path: [taskId],
        });
        return memo.get(taskId)!;
      }

      // Compute paths through all dependencies
      const depResults = task.dependencies.map((dep) => computePath(dep));

      // Find longest dependency path
      let maxLength = task.durationMs;
      let bestDepPath: string[] = [];
      for (const depResult of depResults) {
        if (depResult.length > maxLength - task.durationMs) {
          maxLength = depResult.length + task.durationMs;
          bestDepPath = depResult.path;
        }
      }

      const path = [taskId, ...bestDepPath];
      memo.set(taskId, {
        length: maxLength,
        path,
      });

      return memo.get(taskId)!;
    }

    // Find sink tasks (no other task depends on them)
    const dependents = new Set<string>();
    for (const task of tasks.values()) {
      for (const dep of task.dependencies) {
        dependents.add(dep);
      }
    }

    let sinks = Array.from(tasks.keys()).filter((id) => !dependents.has(id));
    if (sinks.length === 0) {
      sinks = Array.from(tasks.keys());
    }

    // Compute critical path from all sinks
    const paths = sinks.map((sink) => computePath(sink));
    if (paths.length === 0) {
      return [];
    }

    let critical = paths[0];
    for (const p of paths) {
      if (p.length > critical.length) {
        critical = p;
      }
    }

    return critical.path;
  }

  function topologicalOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    function dfs(taskId: string) {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = tasks.get(taskId)!;
      for (const dep of task.dependencies) {
        dfs(dep);
      }

      result.push(taskId);
    }

    // Sort by priority (desc) then ID (asc) to prefer higher priority in traversal
    const sortedIds = Array.from(tasks.keys()).sort((a, b) => {
      const taskA = tasks.get(a)!;
      const taskB = tasks.get(b)!;
      if (taskA.priority !== taskB.priority) {
        return taskB.priority - taskA.priority;
      }
      return a.localeCompare(b);
    });

    for (const id of sortedIds) {
      dfs(id);
    }

    return result;
  }

  return {
    addTask,
    validate,
    detectCycle,
    schedule,
    criticalPath,
    topologicalOrder,
  };
}