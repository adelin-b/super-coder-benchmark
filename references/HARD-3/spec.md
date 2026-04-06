# HARD-3: Dependency-Aware Task Scheduler

## Overview
Implement a task scheduler that processes a directed acyclic graph (DAG) of tasks with dependencies, priorities, and resource constraints. The scheduler must detect cycles, handle priority inversion, prevent starvation, and respect resource limits during execution planning.

## Exported API

```ts
export interface TaskDef {
  id: string;
  priority: number;           // higher = more urgent
  dependencies: string[];     // task IDs this task depends on
  resourceCost: number;       // units of resource this task needs
  durationMs: number;         // simulated execution time
}

export interface ScheduleEntry {
  taskId: string;
  startTime: number;          // relative ms from schedule start
  endTime: number;
  resourcesUsed: number;
}

export interface ScheduleResult {
  entries: ScheduleEntry[];
  makespan: number;           // total time from first start to last end
  order: string[];            // task IDs in execution start order
}

export class SchedulerError extends Error {}

export function createScheduler(config: {
  maxConcurrency: number;     // max tasks running at once
  totalResources: number;     // total resource units available
}): {
  /** Add a task definition. Throws if ID is duplicate. */
  addTask(task: TaskDef): void;

  /** Validate the task graph. Returns list of issues (empty = valid). */
  validate(): string[];

  /** Detect if there are cycles. Returns the cycle path or null. */
  detectCycle(): string[] | null;

  /**
   * Compute the schedule. Throws SchedulerError if graph has cycles.
   * Tasks are scheduled greedily: at each decision point, pick the
   * highest-priority ready task that fits within resource limits.
   */
  schedule(): ScheduleResult;

  /** Get the critical path (longest dependency chain by duration). */
  criticalPath(): string[];

  /** Get topological order (any valid one, but prefer higher priority first). */
  topologicalOrder(): string[];
};
```

## Detailed Requirements

### Task Graph
- Tasks form a DAG where edges are dependencies (A depends on B means B must complete before A starts).
- A task is "ready" when all its dependencies have completed.
- Self-dependencies are invalid (detected by `validate`).

### Scheduling Algorithm
The scheduler uses a **greedy priority-based** approach:

1. Start at time 0 with all resources available.
2. Find all "ready" tasks (dependencies met, not yet started).
3. Sort ready tasks by priority (descending). Break ties by ID (lexicographic ascending).
4. For each ready task in priority order:
   - If adding it would not exceed `maxConcurrency` AND its `resourceCost` fits in remaining resources: schedule it to start now.
   - Otherwise, skip it for now.
5. If no task can be scheduled and tasks are still pending, advance time to the earliest completion of a running task (freeing its resources).
6. Repeat until all tasks are scheduled.

### Anti-Starvation Rule
If a task has been "ready" (all deps met) for more than 3 scheduling rounds without being picked (because higher-priority tasks keep taking resources), temporarily boost its priority to `maxPriority + 1` for the next round. This prevents low-priority tasks from starving indefinitely.

Track "rounds skipped while ready" per task. A "round" is each time step 2-4 above executes.

### Cycle Detection
- Use DFS-based cycle detection.
- `detectCycle()` returns the cycle as a list of task IDs forming the cycle (e.g., `['A', 'B', 'C', 'A']`), or null if no cycle.
- `schedule()` throws `SchedulerError` if cycles exist.

### Critical Path
- The critical path is the longest path through the DAG by sum of `durationMs`.
- If multiple paths tie, return the one whose first divergence point has the higher-priority task.

### Validation
- `maxConcurrency` must be >= 1.
- `totalResources` must be >= 1.
- Task `id` must be non-empty and unique.
- `priority` must be >= 0.
- `resourceCost` must be >= 1 and <= `totalResources`.
- `durationMs` must be > 0.
- Dependencies must reference existing task IDs.
- No self-dependencies.
- `validate()` returns a list of human-readable issue strings (not throws).

### Edge Cases
- Diamond dependencies: A depends on B and C, both B and C depend on D. D runs once, B and C can run in parallel, A runs after both.
- A single task with no dependencies starts immediately.
- All tasks independent = pure priority scheduling with resource constraints.
- A task whose `resourceCost` equals `totalResources` must run alone.

## Invariants
1. No task starts before all its dependencies complete.
2. At any point in the schedule, running tasks' total `resourceCost` <= `totalResources`.
3. At any point, number of running tasks <= `maxConcurrency`.
4. `makespan` equals `max(entry.endTime)` across all entries.
5. `order` lists task IDs sorted by `startTime` (ties broken by priority desc, then ID asc).
6. Every added task appears exactly once in the schedule (assuming no cycles).
