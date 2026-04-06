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

export class SchedulerError extends Error {}

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

  return {
    addTask(task: TaskDef): void {
      if (tasks.has(task.id)) {
        throw new SchedulerError(`Task ID '${task.id}' is duplicate`);
      }
      tasks.set(task.id, task);
    },

    validate(): string[] {
      const issues: string[] = [];

      if (config.maxConcurrency < 1) {
        issues.push("maxConcurrency must be >= 1");
      }
      if (config.totalResources < 1) {
        issues.push("totalResources must be >= 1");
      }

      tasks.forEach((task) => {
        if (!task.id || task.id.trim() === "") {
          issues.push("Task id must be non-empty");
        }
        if (task.priority < 0) {
          issues.push(`Task '${task.id}': priority must be >= 0`);
        }
        if (task.resourceCost < 1 || task.resourceCost > config.totalResources) {
          issues.push(
            `Task '${task.id}': resourceCost must be >= 1 and <= totalResources`
          );
        }
        if (task.durationMs <= 0) {
          issues.push(`Task '${task.id}': durationMs must be > 0`);
        }

        task.dependencies.forEach((dep) => {
          if (dep === task.id) {
            issues.push(`Task '${task.id}': self-dependency not allowed`);
          }
          if (!tasks.has(dep)) {
            issues.push(
              `Task '${task.id}': dependency '${dep}' does not exist`
            );
          }
        });
      });

      return issues;
    },

    detectCycle(): string[] | null {
      const visited = new Set<string>();
      const recStack = new Set<string>();
      const path: string[] = [];

      const dfs = (taskId: string): string[] | null => {
        visited.add(taskId);
        recStack.add(taskId);
        path.push(taskId);

        const task = tasks.get(taskId);
        if (task) {
          for (const dep of task.dependencies) {
            if (!visited.has(dep)) {
              const cycle = dfs(dep);
              if (cycle) return cycle;
            } else if (recStack.has(dep)) {
              const cycleStart = path.indexOf(dep);
              return path.slice(cycleStart).concat([dep]);
            }
          }
        }

        path.pop();
        recStack.delete(taskId);
        return null;
      };

      for (const taskId of tasks.keys()) {
        if (!visited.has(taskId)) {
          const cycle = dfs(taskId);
          if (cycle) return cycle;
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
      const scheduled = new Set<string>();
      let currentTime = 0;
      const running: Map<string, number> = new Map();
      const skippedRounds = new Map<string, number>();

      while (scheduled.size < tasks.size) {
        for (const [taskId, endTime] of running.entries()) {
          if (endTime <= currentTime) {
            running.delete(taskId);
          }
        }

        const ready: string[] = [];
        tasks.forEach((task, id) => {
          if (scheduled.has(id)) return;
          const depsReady = task.dependencies.every((dep) =>
            scheduled.has(dep)
          );
          if (depsReady) {
            ready.push(id);
          }
        });

        if (ready.length === 0 && scheduled.size < tasks.size) {
          if (running.size === 0) break;
          const minEndTime = Math.min(...running.values());
          currentTime = minEndTime;
          continue;
        }

        const maxPriority = Math.max(
          ...Array.from(tasks.values()).map((t) => t.priority),
          0
        );

        const readyWithBoost = ready.map((id) => {
          const skipped = skippedRounds.get(id) || 0;
          const task = tasks.get(id)!;
          const boostedPriority =
            skipped > 3 ? maxPriority + 1 : task.priority;
          return { id, priority: boostedPriority };
        });

        readyWithBoost.sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return a.id.localeCompare(b.id);
        });

        let scheduled_any = false;
        for (const { id } of readyWithBoost) {
          const task = tasks.get(id)!;
          const usedResources = Array.from(running.keys()).reduce(
            (sum, taskId) => sum + tasks.get(taskId)!.resourceCost,
            0
          );

          if (
            running.size < config.maxConcurrency &&
            usedResources + task.resourceCost <= config.totalResources
          ) {
            const startTime = currentTime;
            const endTime = startTime + task.durationMs;

            scheduled.add(id);
            entries.push({
              taskId: id,
              startTime,
              endTime,
              resourcesUsed: task.resourceCost,
            });

            running.set(id, endTime);
            scheduled_any = true;
            skippedRounds.delete(id);
          } else {
            skippedRounds.set(id, (skippedRounds.get(id) || 0) + 1);
          }
        }

        if (!scheduled_any && scheduled.size < tasks.size) {
          if (running.size === 0) break;
          const minEndTime = Math.min(...running.values());
          currentTime = minEndTime;
        }
      }

      const makespan =
        entries.length > 0 ? Math.max(...entries.map((e) => e.endTime)) : 0;

      entries.sort((a, b) => {
        if (a.startTime !== b.startTime) {
          return a.startTime - b.startTime;
        }
        const taskA = tasks.get(a.taskId)!;
        const taskB = tasks.get(b.taskId)!;
        if (taskB.priority !== taskA.priority) {
          return taskB.priority - taskA.priority;
        }
        return a.taskId.localeCompare(b.taskId);
      });

      const order = entries.map((e) => e.taskId);

      return { entries, makespan, order };
    },

    criticalPath(): string[] {
      const memo = new Map<string, { length: number; path: string[] }>();

      const computeLongestPath = (
        taskId: string
      ): { length: number; path: string[] } => {
        if (memo.has(taskId)) {
          return memo.get(taskId)!;
        }

        const task = tasks.get(taskId)!;

        if (task.dependencies.length === 0) {
          const result = { length: task.durationMs, path: [taskId] };
          memo.set(taskId, result);
          return result;
        }

        let maxLength = task.durationMs;
        let bestPath = [taskId];

        for (const dep of task.dependencies) {
          const depPath = computeLongestPath(dep);
          if (depPath.length + task.durationMs > maxLength) {
            maxLength = depPath.length + task.durationMs;
            bestPath = [...depPath.path, taskId];
          }
        }

        const result = { length: maxLength, path: bestPath };
        memo.set(taskId, result);
        return result;
      };

      let longestPath: string[] = [];
      let maxLength = 0;

      tasks.forEach((task, id) => {
        const path = computeLongestPath(id);
        if (path.length > maxLength) {
          maxLength = path.length;
          longestPath = path.path;
        }
      });

      return longestPath;
    },

    topologicalOrder(): string[] {
      const visited = new Set<string>();
      const order: string[] = [];

      const dfs = (taskId: string) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = tasks.get(taskId)!;
        for (const dep of task.dependencies) {
          dfs(dep);
        }

        order.push(taskId);
      };

      const sortedIds = Array.from(tasks.keys()).sort((a, b) => {
        const taskA = tasks.get(a)!;
        const taskB = tasks.get(b)!;
        if (taskB.priority !== taskA.priority) {
          return taskB.priority - taskA.priority;
        }
        return a.localeCompare(b);
      });

      for (const id of sortedIds) {
        dfs(id);
      }

      return order;
    },
  };
}