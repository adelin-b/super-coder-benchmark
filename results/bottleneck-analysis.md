# Bottleneck Analysis: AI Coding Agent Benchmark

**Generated:** 2026-04-06
**Data sources:** 6 autoresearch runs, 4 tournament results, 1 difficulty audit, 6 best prompts, 12+ failing code samples

---

## 1. Per-Task Failure Taxonomy

Based on examination of actual generated code vs. reference test expectations.

### BL-2: Invoice Line Item Calculator
**Best observed:** 90% (9/10) across multiple agents
**Failure mode:** **Missing validation (1-2 tests)** — agents consistently miss edge cases like "throws on percentage discount > 100%" or "throws on empty items". The core computation (line totals, tax, discounts) is usually correct. This is the easiest L2 task.
- Interface mismatch: rare (most agents export `calculateInvoice` correctly)
- Logic error: occasional — percentage discount applied as multiplier instead of percentage (e.g., 10% of 100 = 1000 instead of 10 — seen in audit BL-2 score 0.6)
- Missing validation: PRIMARY FAILURE — empty items, negative quantity, percentage > 100
- Generation failure: never observed

### BL-4: Proration Calculator
**Best observed:** 66.7% (2/3) — never reaches 100% in any autoresearch run
**Failure mode:** **Interface mismatch (dominant)** — the test imports `calculateProration` and `ProrateError` with specific named exports. Agents frequently export the wrong function name or use a class-based API. The audit shows `TypeError: (0, calculateProration) is not a function` accounting for 4/6 failures.
- Interface mismatch: PRIMARY — wrong export name, or returns wrong shape (missing `daysUsed`, `ratio`, `proratedAmount` fields)
- Logic error: date clamping and day-counting off-by-one errors
- Missing validation: throws on negative amount, invalid billing range
- Volatility: score oscillates between 0% and 66.7% across iterations — the function name is either right or wrong

### BL-5: Inventory Reservation System
**Best observed:** 75% (3/4) in effect-ts-v3 iteration 4; all other agents: 0%
**Failure mode:** **Interface mismatch (catastrophic)** — the test expects `createInventory()` factory function returning `{setStock, getAvailable, reserve, release, confirm}`. Every agent EXCEPT the effect-ts-v3 iter 4 generates a CLASS (`InventoryReservationSystem`, `InventorySystem`) or uses different method names (`addStock` instead of `setStock`, `addProduct` instead of `setStock`). The reference test also expects:
  - `reserve(sku, qty, ttlMs?)` — optional TTL parameter
  - `confirm(id)` — confirmation that deducts from stock
  - `InventoryError` as the thrown error class
- Interface mismatch: DOMINANT (100% of failures in plain-ts, pbt, self-critic, stack-tc-pbt)
- Missing method: `confirm()` method absent in most generated code
- Missing TTL: even when interface matches, the `reserve(sku, qty, ttlMs)` TTL/expiry feature is universally missed
- Generation failure: stack-tc-pbt-v1 iteration 0 generated MARKDOWN instead of code
- The effect-ts-v3 iter 4 got 75% because it finally had `createInventory`, `setStock`, `getAvailable`, `reserve`, `release`, `confirm` — but missed TTL expiry

### ALG-2: LRU Cache
**Best observed:** 100% (1/1 in some runs), typically 83-86% (5/6 or 6/7)
**Failure mode:** **Method signature mismatch** — tests call `c.size()` as a method; agents implement `size` as a property. Also: `get(key)` must return `undefined` for cache miss (not `-1` or `null`), and capacity < 1 must throw.
- Interface mismatch: `size()` as method vs property
- Logic error: rare — LRU eviction logic is well-known
- Missing validation: capacity < 1 not throwing

### ALG-3: Topological Sort
**Best observed:** 66.7% (2/3) in multiple agents; frequently 0%
**Failure mode:** **Interface mismatch (catastrophic)** — test imports `topoSort(nodes: string[], edges: string[][])` and `CycleError`. Agents generate:
  - `topologicalSort` instead of `topoSort` (plain-ts-v3)
  - `toposort` returning `{sorted, hasCycle}` instead of throwing `CycleError` (pbt-v2)
  - Graph represented as `Map<number, number[]>` instead of `(string[], string[][])` (plain-ts-v3)
  - Self-critic was the best — when it got the name right, it scored 100% on it (iter 2)
- Interface mismatch: PRIMARY — function name and signature
- Missing validation: self-loop detection, unknown node validation
- The function signature is unusual: `topoSort(nodes, edges)` with string arrays, not a Map-based graph

### SAAS-2: Token Bucket Rate Limiter
**Best observed:** 85.7% (6/7) in effect-ts-v3 iteration 1
**Failure mode:** **Interface mismatch + missing config field** — test expects `createRateLimiter({maxTokens, refillRate, refillIntervalMs})` with three config fields. The effect-ts-v3 iteration 1 success omitted `refillIntervalMs` from its config interface but still scored 6/7. Most agents miss:
  - `RateLimitError` custom error class (tests expect `toThrow(RateLimitError)`)
  - `tryConsume(key, tokens?)` with optional second arg for burst consumption
  - Correct refill: discrete interval-based (not continuous), using `refillIntervalMs`
- Interface mismatch: `RateLimitError` not exported, or wrong config shape
- Logic error: continuous vs interval-based refill
- Missing validation: `maxTokens: 0` must throw

### SAAS-3: Event-Sourced Account
**Best observed:** 50% (1/2) sporadically; typically 0%
**Failure mode:** **Interface mismatch (catastrophic)** — test imports `{createAccount, applyEvent, reconstruct, getBalance, AccountError}` as FIVE separate named exports. Every agent generates either:
  - A class-based `Account` with methods (self-critic, plain-ts-v3)
  - Different function signatures: `deposit(account, amount)` instead of `applyEvent(state, event)`
  - Event types capitalized (`Deposited`) instead of lowercase (`deposited`)
  - Missing `getBalance` helper (balance accessed as property instead)
  - Missing `AccountError` custom error class
  - `fromEvents` instead of `reconstruct`
  - The pbt-v2 got closest with functional style but used `fromEvents` instead of `reconstruct`
  - effect-ts-v3 used `reconstructFromEvents` instead of `reconstruct`

The reference expects events as plain objects: `{type: 'deposited', amount: number, timestamp: number}` with LOWERCASE event types. Every agent capitalizes them (`Deposited`, `Withdrawn`).

---

## 2. Parameter Space Map

| Parameter | Current Range | Observed Impact | Optimal Value |
|---|---|---|---|
| System prompt length | ~150-700 tokens | Low-moderate. Longer prompts with specific rules help validation but don't fix interface mismatches. Effect-ts-v3 best prompt is 700 tokens with explicit export patterns. | 500-700 tokens with concrete patterns |
| Pre-coding checklist | absent/present (plain-ts-v2, plain-ts-v3 have "Before writing code: list every function/class") | +5-10% — forces agent to enumerate exports before coding. Present in 78.3% scorer. | Present — mandatory |
| Self-review step | absent/present (plain-ts-v3 has "Self-review: verify every export exists") | Negligible (+0-2%). plain-ts-v3 best = 70.8% vs plain-ts-v2 best = 78.3% (WORSE with 7 tasks). Review step doesn't prevent the fundamental mismatch. | Present but low impact |
| Self-critique step | absent/present (self-critic-v1 has explicit "CRITIQUE your implementation") | Negative to neutral. self-critic-v1 best = 68.2% — WORSE than plain-ts-v2 (78.3%). The critique adds tokens but doesn't fix root cause. | Skip — wastes tokens |
| Context bundle (docs) | 0-2600 tokens (v1 vs v2 Effect TS had docs) | Zero impact. v1-vs-v2-comparison shows v1 (no docs) = v2 (with docs) on BL-1 (both 94.74%), BL-5 (both 0%), SAAS-3 (both 0%). | 0 — docs don't help |
| Method paradigm | plain-ts / effect-ts / pbt / tdd / stack-tc-pbt / self-critic | Moderate. Effect-ts-v3 = 79.3% (CHAMPION). Plain-ts-v2 = 78.3%. pbt-v2 = 69.6%. self-critic = 68.2%. stack-tc-pbt = 76.2%. Effect boundary wrapping provides structural advantage. | Effect-ts with boundary wrapping |
| Model (generator) | haiku / sonnet | COUNTERINTUITIVE: Haiku outperforms Sonnet. R1 (haiku) leaderboard has scores up to 90% on BL-2. R2 (sonnet) scored: BL-2=87.5%, BL-4=0-66.7%, BL-5=0%, ALG-2=66.7%, ALG-3=0%, SAAS-2=0-50%, SAAS-3=0-50%. Sonnet generates more elaborate but WRONG code. | Haiku for one-shot generation |
| Model (improver) | sonnet | Used only in autoresearch meta-loop. Effective at analyzing failures and suggesting prompt changes. | Sonnet — appropriate |
| Autoresearch iterations | 5-6 | Diminishing returns after 2-3. Best iteration: effect-ts-v3 = iter 1 (79.3%); plain-ts-v2 = iter 5 (78.3%); plain-ts-v3 = iter 1 (70.8%); stack-tc-pbt = iter 2 (76.2%). | 3-4 sufficient |
| Task count in autoresearch | 5-7 | More tasks = harder optimization. plain-ts-v2 (5 tasks) = 78.3%. plain-ts-v3 (7 tasks) = 70.8%. Multi-task tension dominates. | 5-6 tasks for optimization, full set for validation |
| Temperature | default | Not varied — unknown impact | Needs experimentation |
| Max turns (iteration loops) | 1 (one-shot) | **CRITICAL BOTTLENECK.** All interface mismatches would be caught by a single typecheck round. BL-5 fails 100% in most agents due to wrong export names — a `tsc` check would catch `createInventory is not a function`. | 2-3 rounds with typecheck feedback |
| Boundary wrapping instruction | absent/present | +23% (effect-ts v1→v3). Effect-ts-v3 added "EXPORTS PLAIN TYPESCRIPT INTERFACES" rule with explicit `Effect.runSync` boundary pattern. This was the single biggest improvement. SAAS-3 went from 0% to 50%. | Present — with concrete code pattern |
| Export name specification | absent/vague/explicit | **CRITICAL.** Effect-ts-v3 best prompt explicitly lists: "Test calls `createRateLimiter(...)` and then `rl.tryConsume(userId)`, `rl.getRemaining(userId)`, `rl.reset(userId)`". This specificity drives the 79.3% score. | Explicit — list every expected export name per task |
| Validation rules | absent/vague/explicit | Moderate (+5-10%). plain-ts-v2 best prompt has "Throw errors for ALL invalid inputs described in the spec: negative numbers, empty arrays..." This helps BL-2 validation but doesn't fix interface mismatches. | Explicit with cap-vs-throw distinction |
| Example code in prompt | absent/present | Moderate (+10-15%). Effect-ts-v3 includes a full code pattern for boundary wrapping. This is more effective than abstract rules. | Present — one concrete pattern |

---

## 3. Bottleneck Ranking

**Rank 1: Interface mismatch (wrong export names/signatures) — ~40% of all test failures**
Evidence: BL-5 scores 0% across 5/6 agents because test expects `createInventory()` but agents generate `InventoryReservationSystem` class. SAAS-3 scores 0% because test expects `{createAccount, applyEvent, reconstruct, getBalance, AccountError}` but agents generate class-based APIs. ALG-3 scores 0% when agents name function `topologicalSort` instead of `topoSort`. The audit shows `TypeError: (0, ...) is not a function` as the #1 error message.

**Rank 2: One-shot architecture (no typecheck feedback loop) — enables Rank 1**
Evidence: Every interface mismatch would be caught by running `tsc` or `vitest --run` once and reading the error. The system currently generates code and evaluates it with NO opportunity to fix compilation errors. A single feedback round would eliminate all `TypeError: is not a function` failures.

**Rank 3: Prompt overfitting to some tasks at expense of others (multi-task tension)**
Evidence: plain-ts-v3 iter 2 improved ALG-3 to 66.7% but ALG-2 dropped to 0% and SAAS-2 dropped to 0%. pbt-v2 iter 5 got SAAS-2 to 100% but ALG-2 dropped to 0% and ALG-3 dropped to 50%. Autoresearch iterations after the best often get WORSE because fixing one task's prompt hurts another's.

**Rank 4: API design ambiguity in specs — agents can't infer exact signatures**
Evidence: BL-5 spec could mean class or factory. SAAS-3 spec could mean OOP or functional event-sourcing. ALG-3 could be `topoSort` or `topologicalSort`. The spec doesn't constrain strongly enough, and without seeing the test file, the agent guesses wrong. The best prompts (effect-ts-v3) mitigate this by listing exact method signatures.

**Rank 5: Sonnet performs WORSE than Haiku on this benchmark**
Evidence: R2-sonnet results: 0/7 tasks fully passing. BL-5=0%, ALG-3=0%, SAAS-2=0%, SAAS-3=0%. Same prompts with Haiku score higher. Sonnet generates longer, more elaborate code with more abstraction — but this INCREASES the chance of interface mismatch. Sonnet's BL-5 generated 4220 tokens of elaborate inventory code; Haiku generates 1661-2570 tokens of simpler code that more often matches the expected interface.

**Rank 6: Missing TTL/expiry features in complex tasks**
Evidence: BL-5 reference implementation has `reserve(sku, qty, ttlMs?)` with optional TTL and auto-expiry via `Date.now()` check. Even the effect-ts-v3 iteration 4 that scored 75% on BL-5 missed the TTL feature entirely. No agent has ever implemented reservation expiry.

**Rank 7: Event type casing mismatch (SAAS-3 specific)**
Evidence: Reference uses lowercase: `{type: 'deposited', amount: 100}`. Every single generated implementation uses TitleCase: `{type: 'Deposited'}`. This alone causes SAAS-3 to fail even when the structure is correct. This is a micro-variant of Rank 1 but particularly insidious.

**Rank 8: PBT/Effect paradigm friction**
Evidence: pbt-v2 best = 69.6% vs plain-ts-v2 best = 78.3%. PBT adds fast-check noise and property-based tests that don't help the agent generate correct implementations. Effect-ts-v3 with boundary wrapping (79.3%) overcomes this, but only because the boundary pattern forces correct plain-TS exports.

**Rank 9: Autoresearch meta-optimizer instability**
Evidence: pbt-v2 peaked at iteration 0 (69.6%) and every subsequent iteration was WORSE (64.7%, 61.1%, 53.3%, 56.3%, 60.0%). The Sonnet improver makes changes that seem logical but hurt overall performance. The search space is noisy and the optimizer has no gradient signal.

**Rank 10: Generation failures (markdown, truncation, import errors)**
Evidence: stack-tc-pbt-v1 iteration 0 generated markdown for BL-5: `# BL-5: Inventory Reservation System\nReserve stock, release...` instead of TypeScript code. Effect-ts-v3 iteration 4 BL-5 used `import { crypto } from "node:crypto"` (wrong syntax — should be `import crypto from "node:crypto"` or `import { randomUUID } from "node:crypto"`). These are rare (~5% of generations) but catastrophic.

---

## 4. Multi-Task Tension Analysis

### Observed Conflicts

**ALG-2 vs ALG-3 vs SAAS-2 vs SAAS-3:**
In plain-ts-v3 iteration 2: ALG-3 improved to 66.7% BUT ALG-2 dropped to 0%, SAAS-2 dropped to 0%, SAAS-3 stayed at 50%. The prompt change that helped ALG-3 (emphasizing exact function names) may have over-constrained ALG-2's class-based API expectations.

**BL-4 oscillation:**
BL-4 oscillates between 0% and 66.7% across iterations in EVERY agent. It's either 0/1 or 2/3 — never stable. The function name `calculateProration` either matches or doesn't; there's no partial credit.

**SAAS-2 vs SAAS-3:**
These tasks conflict because SAAS-2 wants a factory pattern (`createRateLimiter`) while SAAS-3 wants separate functions (`createAccount`, `applyEvent`, `reconstruct`, `getBalance`). A prompt optimized for factory patterns helps SAAS-2 but doesn't help SAAS-3's multi-export pattern.

### Root Cause: Prompt Generality vs. Task Specificity

The fundamental tradeoff is:
- **Generic prompts** ("export all functions the tests import") help across tasks but miss task-specific naming conventions
- **Specific prompts** (listing exact export names per task) maximize one task but don't generalize

The current autoresearch tries to find ONE prompt that works for ALL tasks. This is inherently limited because tasks have conflicting interface patterns (factory vs. class vs. standalone functions).

### Is This Resolvable?

**Yes, with task-adaptive prompting.** Instead of one universal prompt, the system could:
1. Detect the task type from the spec
2. Apply task-specific export templates (factory pattern for SAAS-2, multi-function pattern for SAAS-3)
3. This doesn't require per-task overfitting — just 3-4 interface patterns

However, within the current one-prompt-for-all architecture, the ceiling is fundamentally limited to ~80%.

---

## 5. Ceiling Analysis

### Current One-Shot Architecture (no feedback): ~80%

Evidence: effect-ts-v3 best = 79.3%. plain-ts-v2 best = 78.3%. These are the best observed scores.

Theoretical ceiling: ~82-85%. Some tasks (BL-2, ALG-2) are already at 85-90%. The remaining gap is BL-5 (0%), SAAS-3 (0%), ALG-3 (0-66.7%), which fail due to interface mismatches that a prompt alone cannot reliably fix.

### With Typecheck Feedback Loop (2-3 rounds): ~92-95%

Evidence basis: The dominant failure mode is `TypeError: (0, ...) is not a function`. A single `tsc` or `vitest --run` would produce this error message. The agent could then:
1. See "createInventory is not a function"
2. Rename `InventoryReservationSystem` → `createInventory()` factory
3. Re-run and fix remaining errors

This would eliminate:
- All interface mismatches (BL-5: 0% → 75%+, SAAS-3: 0% → 70%+, ALG-3: 0% → 85%+)
- All export name errors (BL-4: volatile → stable 66-83%)
- Import errors (uuid, crypto)

Remaining failures would be purely LOGIC errors (TTL expiry, rounding, edge cases).

### With Full Agentic Iteration (read/write/test loop): ~95-98%

With ability to read test files, run tests, and iterate:
- Agent could read the test imports directly: `import { createInventory, InventoryError } from './inventory.js'`
- Agent could see test assertions and understand exact expected behavior
- Logic errors (TTL, event casing, rounding) would be caught by running tests and reading failure messages
- Remaining gap: subtle semantic bugs (TTL race conditions, float precision)

### With Model Upgrade to Opus: +3-5%

Evidence: Sonnet performed WORSE than Haiku on this benchmark (more tokens, more abstraction, more interface mismatch). Opus would likely be similar to Sonnet in this failure mode. The bottleneck is NOT model capability — it's the one-shot architecture. Opus would help most with:
- Complex logic (BL-5 TTL, SAAS-3 event sourcing)
- Following intricate specifications precisely
- But only if interface mismatch is already solved (feedback loop)

| Architecture | Estimated Ceiling | Key Constraint |
|---|---|---|
| Current one-shot | 80-85% | Interface mismatch |
| + typecheck feedback (2 rounds) | 92-95% | Logic errors |
| + full test feedback (3 rounds) | 95-98% | Subtle semantic bugs |
| + Opus model | 97-99% | Only helps after feedback loop |

---

## 6. Proposed Ultimate Agent Configuration

### Paradigm: Plain TypeScript with structural guardrails

**Why not Effect-ts?** Effect-ts-v3 is the current champion (79.3%) but the win comes from the BOUNDARY WRAPPING instruction, not from Effect itself. The v1-vs-v2 comparison shows Effect docs add zero value. The boundary pattern forces correct plain-TS exports, which is the actual mechanism. A plain-TS prompt with equivalent structural guardrails would achieve the same result without Effect's import overhead and paradigm friction.

**Why not PBT?** PBT adds token overhead for property tests that don't improve implementation correctness. pbt-v2 scored 69.6% — worse than plain-ts-v2's 78.3%.

### System Prompt Structure (recommended order)

```
1. ROLE (1 line): "You are a TypeScript developer. Output ONLY valid TypeScript."

2. EXPORT CONTRACT (critical section, ~150 tokens):
   - "Every function, class, type the tests import MUST be exported"
   - "Use EXACT function/class names from the spec"
   - "Factory functions must return objects with ALL methods tests call"
   - "NEVER use default exports"
   
3. VALIDATION RULES (~100 tokens):
   - Cap vs. throw distinction
   - Specific error class requirements
   - Input validation ordering

4. INTERFACE PATTERNS (~100 tokens):
   - Factory pattern: `export function createX() { return { method1, method2 } }`
   - Functional pattern: `export function fn1(); export function fn2()`
   - Class pattern: `export class X { method() as METHOD not property }`

5. PRE-CODING CHECKLIST (~50 tokens):
   - "Before writing code: list every export the spec requires"
   - "List every method on returned objects"
   - "List every error class needed"

6. COMMON PITFALLS (~100 tokens):
   - "get(key) returns undefined for miss, not -1 or null"
   - "Event types in lowercase: 'deposited' not 'Deposited'"
   - "Use crypto.randomUUID() not uuid package"
   - "size() as method, not property"

7. OUTPUT FORMAT (1 line):
   - "Reply with code ONLY in a single ```typescript block"
```

Total: ~500-600 tokens. No examples, no Effect docs, no PBT instructions.

### Context Bundles

- **None.** The v1-vs-v2 comparison proves Effect docs add zero value. The spec itself is sufficient context. Additional docs waste tokens and may confuse the model.

### Model Selection

| Use Case | Model | Rationale |
|---|---|---|
| Code generation | Haiku | Generates simpler, more correct code. Lower token count = less interface mismatch. Counterintuitive but data-driven. |
| Autoresearch improver | Sonnet | Needs reasoning about failure patterns and prompt optimization |
| Validation (if feedback loop added) | Haiku | Just needs to read error messages and fix |
| Complex tasks (with feedback) | Sonnet | After interface is correct, Sonnet's reasoning helps with logic |

### Iteration Strategy

**Priority 1: Add typecheck feedback loop**
1. Generate code (Haiku)
2. Run `tsc --noEmit` or `vitest --run` 
3. If errors: feed error messages back, regenerate (Haiku)
4. Repeat up to 2 more times
5. Expected impact: +12-15%

**Priority 2: Task-adaptive prompting**
1. Classify task spec into interface pattern (factory / functional / class)
2. Append pattern-specific export template to prompt
3. Expected impact: +5-8% (reduces multi-task tension)

### Autoresearch Strategy

1. Run 3-4 iterations (not 5-6 — diminishing returns)
2. Use 5 tasks for optimization, 7 for validation
3. Track per-task scores and REJECT iterations that drop any task by >20%
4. Implement a Pareto constraint: never accept a prompt that regresses any task to 0%
5. Use the improver to suggest TARGETED fixes (not rewrite the whole prompt)

---

## 7. Diminishing Returns Analysis

### Evidence of Diminishing Returns

| Agent | Iter 0 | Best | Best Iter | Iters After Best (all worse) |
|---|---|---|---|---|
| plain-ts-v2 | 68.8% | 78.3% | 5 | 0 (last iter) |
| plain-ts-v3 | 62.5% | 70.8% | 1 | 3 worse |
| stack-tc-pbt-v1 | 75.0% | 76.2% | 2 | 3 worse |
| self-critic-v1 | 66.7% | 68.2% | 1 | 3 worse |
| pbt-v2 | 69.6% | 69.6% | 0 | 5 worse |
| effect-ts-v3 | 64.7% | 79.3% | 1 | 3 worse |

**Key findings:**

1. **Most agents peak by iteration 1-2.** 4/6 agents have their best score at iteration 0 or 1. Only plain-ts-v2 peaks at iteration 5, and this appears to be luck (the score oscillated: 68.8% → 64.3% → 73.3% → 70.6% → 69.2% → 78.3%).

2. **Post-peak iterations are destructive.** pbt-v2 started at its best (69.6%) and EVERY subsequent iteration was worse, bottoming at 53.3%. The improver actively makes things worse after the initial gain.

3. **The improvement curve is concave.** First iteration gains: +14.6% (effect-ts-v3), +8.3% (plain-ts-v3), +1.5% (self-critic). Second iteration gains from best: usually negative.

4. **The signal-to-noise ratio collapses.** With 5-7 tasks and stochastic generation, a single test run per prompt is noisy. The improver sees correlations that aren't real and makes changes that seem logical but hurt other tasks.

### Law of Diminishing Returns in Prompt Optimization

**Yes, there is a clear law of diminishing returns.** The data shows:

- **First 20% of effort captures 80% of gains.** The initial prompt (iteration 0) already captures most of what's achievable. The first improvement iteration captures the remaining easy wins.
- **After iteration 2, the expected value of an iteration becomes negative.** The average score DECREASES from best across all agents after their peak.
- **The ceiling is architectural, not prompt-level.** No amount of prompt optimization can fix the fundamental one-shot interface mismatch problem. The 79.3% ceiling is structural.

### When to Stop Autoresearch

**Stop after 3 iterations if no improvement in the last 2.** The data strongly suggests:
- If iter 1 > iter 0: try iter 2
- If iter 2 > iter 1: try iter 3
- Otherwise: stop and use the best so far
- NEVER exceed 5 iterations — the expected value is negative

The plateau at ~79% is real and cannot be broken by prompt optimization alone. The next breakthrough requires architectural change (feedback loops, task-adaptive prompting, or multi-turn generation).
