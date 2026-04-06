import { Effect, Exit, Cause, Data } from "effect";

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
}) {
  if (config.maxConcurrency < 1) {
    throw new Error("maxConcurrency must be >= 1");
  }
  if (config.totalResources < 1) {
    throw new Error("totalResources must be >= 1");
  }

  const tasks = new Map<string, TaskDef>();

  return {
    addTask(task: TaskDef): void {
      if (tasks.has(task.id)) {
        throw new Error(`Task ID '${task.id}' is duplicate`);
      }
      tasks.set(task.id, task);
    },

    validate(): string[] {
      const issues: string[] = [];

      for (const [id, task] of tasks) {
        if (!id) {
          issues.push("Task ID must be non-empty");
        }
        if (task.priority < 0) {
          issues.push(`Task '${id}': priority must be >= 0`);
        }
        if (task.resourceCost < 1) {
          issues.push(`Task '${id}': resourceCost must be >= 1`);
        }
        if (task.resourceCost > config.totalResources) {
          issues.push(
            `Task '${id}': resourceCost ${task.resourceCost} exceeds totalResources ${config.totalResources}`
          );
        }
        if (task.durationMs <= 0) {
          issues.push(`Task '${id}': durationMs must be > 0`);
        }

        for (const dep of task.dependencies) {
          if (!tasks.has(dep)) {
            issues.push(`Task '${id}': dependency '${dep}' does not exist`);
          }
          if (dep === id) {
            issues.push(`Task '${id}': self-dependency not allowed`);
          }
        }
      }

      return issues;
    },

    detectCycle(): string[] | null {
      const visited = new Set<string>();
      const recStack = new Set<string>();
      let cycleFound: string[] | null = null;

      const dfs = (nodeId: string, path: string[]): boolean => {
        if (cycleFound) return true;

        visited.add(nodeId);
        recStack.add(nodeId);
        path.push(nodeId);

        const task = tasks.get(nodeId);
        if (!task) {
          path.pop();
          return false;
        }

        for (const dep of task.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep, path)) return true;
          } else if (recStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            cycleFound = [...path.slice(cycleStart), dep];
            path.pop();
            return true;
          }
        }

        path.pop();
        recStack.delete(nodeId);
        return false;
      };

      for (const taskId of tasks.keys()) {
        if (!visited.has(taskId)) {
          if (dfs(taskId, [])) {
            return cycleFound;
          }
        }
      }

      return null;
    },

    schedule(): ScheduleResult {
      const cycle = this.detectCycle();
      if (cycle) {
        throw new SchedulerError(`Cycle detected: ${cycle.join(" -> ")}`);
      }

      const entries: ScheduleEntry[] = [];
      const taskStartTimes = new Map<string, number>();
      const taskEndTimes = new Map<string, number>();
      const scheduled = new Set<string>();
      const readyRoundsSkipped = new Map<string, number>();

      let currentTime = 0;

      while (scheduled.size < tasks.size) {
        // Find ready tasks (dependencies complete, not yet scheduled)
        const ready: string[] = [];
        for (const [taskId] of tasks) {
          if (scheduled.has(taskId)) continue;
          const task = tasks.get(taskId)!;
          if (task.dependencies.every((dep) => scheduled.has(dep))) {
            ready.push(taskId);
          }
        }

        if (ready.length === 0) {
          // No ready tasks, advance time to next completion
          let nextTime = Infinity;
          for (const [taskId] of tasks) {
            if (scheduled.has(taskId)) {
              nextTime = Math.min(nextTime, taskEndTimes.get(taskId)!);
            }
          }
          if (nextTime === Infinity) break;
          currentTime = nextTime;
          continue;
        }

        // Track rounds skipped
        for (const taskId of ready) {
          const count = (readyRoundsSkipped.get(taskId) || 0) + 1;
          readyRoundsSkipped.set(taskId, count);
        }

        // Sort ready tasks: priority desc, ties broken by ID asc
        // Apply anti-starvation boost if skipped > 3 rounds
        const maxPriority = Math.max(
          ...Array.from(tasks.values()).map((t) => t.priority),
          0
        );

        const sorted = ready.sort((a, b) => {
          const taskA = tasks.get(a)!;
          const taskB = tasks.get(b)!;
          const skippedA = readyRoundsSkipped.get(a) || 0;
          const skippedB = readyRoundsSkipped.get(b) || 0;

          const priorityA =
            skippedA > 3 ? maxPriority + 1 : taskA.priority;
          const priorityB =
            skippedB > 3 ? maxPriority + 1 : taskB.priority;

          if (priorityA !== priorityB) {
            return priorityB - priorityA;
          }
          return a.localeCompare(b);
        });

        // Calculate current resource usage
        let usedResources = 0;
        let runningCount = 0;
        for (const [taskId] of tasks) {
          if (
            scheduled.has(taskId) &&
            taskStartTimes.get(taskId)! <= currentTime &&
            taskEndTimes.get(taskId)! > currentTime
          ) {
            usedResources += tasks.get(taskId)!.resourceCost;
            runningCount++;
          }
        }

        // Try to schedule ready tasks
        for (const taskId of sorted) {
          const task = tasks.get(taskId)!;
          if (
            runningCount < config.maxConcurrency &&
            usedResources + task.resourceCost <= config.totalResources
          ) {
            taskStartTimes.set(taskId, currentTime);
            taskEndTimes.set(taskId, currentTime + task.durationMs);
            scheduled.add(taskId);
            readyRoundsSkipped.delete(taskId);

            entries.push({
              taskId,
              startTime: currentTime,
              endTime: currentTime + task.durationMs,
              resourcesUsed: task.resourceCost,
            });

            usedResources += task.resourceCost;
            runningCount++;
          }
        }

        // If nothing was scheduled, advance time
        if (entries.length === 0 || scheduled.size > entries.length) {
          let nextTime = Infinity;
          for (const [taskId] of tasks) {
            if (scheduled.has(taskId)) {
              nextTime = Math.min(nextTime, taskEndTimes.get(taskId)!);
            }
          }
          if (nextTime === Infinity || nextTime <= currentTime) break;
          currentTime = nextTime;
        }
      }

      // Calculate makespan
      let makespan = 0;
      for (const entry of entries) {
        makespan = Math.max(makespan, entry.endTime);
      }

      // Build order: sorted by startTime, then priority desc, then ID asc
      const order = Array.from(entries)
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

      return {
        entries,
        makespan,
        order,
      };
    },

    criticalPath(): string[] {
      const memo = new Map<
        string,
        { totalLength: number; path: string[] }
      >();

      const dfs = (taskId: string): { totalLength: number; path: string[] } => {
        if (memo.has(taskId)) {
          return memo.get(taskId)!;
        }

        const task = tasks.get(taskId)!;

        if (task.dependencies.length === 0) {
          const result = { totalLength: task.durationMs, path: [taskId] };
          memo.set(taskId, result);
          return result;
        }

        let maxLength = task.durationMs;
        let maxPath: string[] = [taskId];

        for (const dep of task.dependencies) {
          const depResult = dfs(dep);
          const candidateLength = depResult.totalLength + task.durationMs;

          if (candidateLength > maxLength) {
            maxLength = candidateLength;
            maxPath = [...depResult.path, taskId];
          }
        }

        const result = { totalLength: maxLength, path: maxPath };
        memo.set(taskId, result);
        return result;
      };

      let globalMaxLength = 0;
      let globalMaxPath: string[] = [];

      for (const taskId of tasks.keys()) {
        const result = dfs(taskId);
        if (result.totalLength > globalMaxLength) {
          globalMaxLength = result.totalLength;
          globalMaxPath = result.path;
        }
      }

      return globalMaxPath;
    },

    topologicalOrder(): string[] {
      const visited = new Set<string>();
      const result: string[] = [];

      const dfs = (taskId: string) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = tasks.get(taskId)!;
        for (const dep of task.dependencies) {
          dfs(dep);
        }

        result.push(taskId);
      };

      // Visit tasks in priority order (desc), then ID order (asc)
      const sortedByPriority = Array.from(tasks.values()).sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.id.localeCompare(b.id);
      });

      for (const task of sortedByPriority) {
        dfs(task.id);
      }

      return result;
    },
  };
}