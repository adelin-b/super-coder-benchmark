# HARD Tasks Championship Results

Run date: 2026-04-06  
Model: Haiku  
Tasks: HARD-1 through HARD-5 (new hard-difficulty tasks)  
Agents: Top 3 from L2 championship  

## Per-Agent Per-Task Results

| Agent | HARD-1 (22) | HARD-2 (25) | HARD-3 (20) | HARD-4 (20) | HARD-5 (27) | Avg Pass Rate |
|-------|-------------|-------------|-------------|-------------|-------------|---------------|
| effect-critic/v2 | 22/22 (100%) | 25/25 (100%) | 15/20 (75%) | 20/20 (100%) | 0/27 (0% ERR) | **75.0%** |
| effect-pbt/v2 | 22/22 (100%) | 25/25 (100%) | 0/20 (0% ERR) | 18/20 (90%) | 0/27 (0% ERR) | **58.0%** |
| ultra-ts/v2 | 22/22 (100%) | 25/25 (100%) | 15/20 (75%) | 19/20 (95%) | 26/27 (96.3%) | **93.3%** |

Numbers in header parentheses = total tests per task.  
ERR = code was truncated (output token limit hit), tests could not load.

## Verdict Summary (pass = 100% tests)

| Agent | HARD-1 | HARD-2 | HARD-3 | HARD-4 | HARD-5 | Pass Count |
|-------|--------|--------|--------|--------|--------|------------|
| effect-critic/v2 | PASS | PASS | FAIL | PASS | ERROR | 3/5 (60%) |
| effect-pbt/v2 | PASS | PASS | ERROR | FAIL | ERROR | 2/5 (40%) |
| ultra-ts/v2 | PASS | PASS | FAIL | FAIL | FAIL | 2/5 (40%) |

## HARD vs L2 Score Comparison

| Agent | L2 Score | HARD Pass Rate | HARD Verdict Rate | Delta |
|-------|----------|----------------|-------------------|-------|
| effect-critic/v2 | 86.5% | 75.0% | 60% | -26.5pp verdict, -11.5pp pass rate |
| effect-pbt/v2 | 83.3% | 58.0% | 40% | -43.3pp verdict, -25.3pp pass rate |
| ultra-ts/v2 | 80.0% | 93.3% | 40% | -40.0pp verdict, +13.3pp pass rate |

## Task Difficulty Analysis

| Task | Description | Avg Pass Rate | Hardest For |
|------|-------------|---------------|-------------|
| HARD-1: Sliding Window Limiter | Token bucket + sliding window | **100%** | Nobody - all agents aced it |
| HARD-2: Event Store | Append-only event store with snapshots | **100%** | Nobody - all agents aced it |
| HARD-3: Task Scheduler | Dependency-aware scheduler with resources, anti-starvation, critical path | **50.0%** | effect-pbt (truncated output) |
| HARD-4: Multi-Currency Ledger | Double-entry accounting with exchange rates | **95.0%** | All agents miss edge cases |
| HARD-5: RBAC with Temporal Perms | Role-based access control with time windows, inheritance | **32.1%** | effect-critic & effect-pbt (truncated) |

### Genuinely Hard Tasks (by design)

**HARD-1 and HARD-2 are NOT hard enough** -- all 3 agents scored 100%. These are comparable to L2-level tasks despite the "HARD" label.

**HARD-3 (Task Scheduler)** is moderately hard:
- Requires cycle detection returning the actual cycle path, critical path analysis, resource-constrained scheduling, and anti-starvation
- Common failures: cycle detection format, validation edge cases (duplicate IDs, invalid config, resource cost checks)
- effect-pbt hit output token limit entirely (2 lines of code generated)

**HARD-4 (Ledger)** is the sweet spot:
- All agents get close (90-100%) but miss subtle edge cases
- Common failure: accounting equation invariant across multiple entries
- Only effect-critic achieved 100%

**HARD-5 (RBAC)** is the hardest:
- Complex spec requiring temporal permission windows, role hierarchy with transitive inheritance
- TWO agents (effect-critic, effect-pbt) hit the output token limit, producing truncated/broken code
- ultra-ts managed 26/27 (96.3%) -- only missed edge case for "no role assignments"
- The spec is large enough (144 lines) that multi-turn agents spend too many tokens on Effect/PBT scaffolding

## Key Failure Modes

### 1. Output Token Exhaustion (Critical)
The dominant failure mode on HARD tasks. effect-critic and effect-pbt both use multi-turn prompting which burns tokens on reasoning/scaffolding. On HARD-5 (largest spec), both produced truncated TypeScript that could not even parse.

**Affected:** effect-critic (HARD-5), effect-pbt (HARD-3, HARD-5)

### 2. Validation Edge Cases
On HARD-3, agents miss uncommon validation rules: duplicate task IDs, invalid scheduler config, resource cost exceeding total. These are "throws on bad input" tests that require reading the spec carefully.

**Affected:** effect-critic (HARD-3: 5 failures), ultra-ts (HARD-3: 5 failures)

### 3. Subtle Invariant Violations
On HARD-4, agents miss multi-entry accounting equation checks. On HARD-5, the "no role assignments" edge case trips up ultra-ts.

### 4. Critical Path Computation
HARD-3's `criticalPath()` function requires longest-path-through-DAG computation. Both effect-critic and ultra-ts fail this specific test.

## Conclusions

1. **ultra-ts/v2 is the most robust on HARD tasks** -- its simpler single-shot approach avoids token exhaustion and achieves the highest average pass rate (93.3%). However, it never achieves 100% on the truly hard tasks.

2. **Multi-turn agents are penalized on complex specs** -- the Effect/PBT scaffolding burns tokens that could be spent on implementation. This creates a "complexity ceiling" where token budget becomes the bottleneck.

3. **Only 3 of 5 HARD tasks are genuinely harder than L2** -- HARD-1 and HARD-2 should be reclassified or made more complex. HARD-3, HARD-4, and HARD-5 achieve the desired difficulty separation.

4. **The expected <30% pass rate was only seen on HARD-5** for 2/3 agents (due to truncation). The tasks are hard but not as punishing as expected -- Haiku can still handle them when given enough token budget.
