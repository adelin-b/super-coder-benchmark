# Phase 6.5 — Difficulty Audit (Claude Haiku one-shot)

**Date:** 2026-04-06
**Model:** `claude-haiku` (via `@anthropic-ai/claude-agent-sdk`)
**SDK version:** `@anthropic-ai/claude-agent-sdk@0.2.92`
**Runner:** `tsx@4.21.0`
**Harness:** `scripts/audit-haiku.mts`
**Auth:** Claude Code subscription (inherited; no `ANTHROPIC_API_KEY` set)

## Isolation configuration (passed to every `query()` call)

```ts
options: {
  model: "haiku",
  allowedTools: [],
  disallowedTools: [],
  mcpServers: {},
  settingSources: [],          // no CLAUDE.md, no hooks, no filesystem settings
  systemPrompt: "You are an expert TypeScript engineer. Reply with code ONLY inside a single fenced ```typescript block. No explanations, no preamble, no trailing prose.",
  permissionMode: "default",
}
```

One-shot per task: the user prompt contains only the task's `spec.md` plus a short
wrapper asking for the file contents inside a single fenced block. The harness
extracts the first ` ```typescript ` (or ` ```ts ` / bare ` ``` `) block, writes
it to `experiments/AUDIT_haiku/<TASK>/<file>.ts`, and copies the reference
test file alongside it for verification.

## 1. Summary table

| Task   | Gen | Passed / Total | Rate | Verdict               |
|--------|-----|----------------|-----:|-----------------------|
| BL-1   | OK  | 18 / 21        |  86% | L1-mostly             |
| BL-2   | OK  |  6 / 10        |  60% | L2-borderline         |
| BL-3   | OK  |  7 / 8         |  88% | L1-mostly             |
| BL-4   | OK  |  2 / 6         |  33% | L2-hard               |
| BL-5   | OK  |  0 / 7         |   0% | L2-hard               |
| ALG-1  | OK  | 16 / 16        | 100% | **L1-saturated**      |
| ALG-2  | OK  |  5 / 7         |  71% | L2-borderline         |
| ALG-3  | OK  |  2 / 7         |  29% | L2-hard               |
| SAAS-1 | OK  | 12 / 13        |  92% | L1-mostly             |
| SAAS-2 | OK  |  1 / 7         |  14% | L2-hard               |
| SAAS-3 | OK  |  0 / 8         |   0% | L2-hard               |

**Totals:** 69 / 110 tests passing (62.7%). 11/11 tasks generated (no SDK or auth
failures, no empty responses, no markdown extraction failures).

**Verdict distribution:**

| Verdict            | Count | Tasks                                    |
|--------------------|------:|------------------------------------------|
| L1-saturated       |     1 | ALG-1                                    |
| L1-mostly          |     3 | BL-1, BL-3, SAAS-1                       |
| L2-borderline      |     2 | BL-2, ALG-2                              |
| L2-hard            |     5 | BL-4, BL-5, ALG-3, SAAS-2, SAAS-3        |
| L2-failed-to-compile | 0   | —                                        |

## 2. Per-task detail

### BL-1 — pricing (L1-mostly, 18/21, 86%)

- Tokens: in=9, out=2417, cache_read=22612, cache_create=1568, duration=16.2s, cost=$0.0428
- Failures (all 3): missing input validation — rejects NaN/Infinity, negative tolerance, empty array all failed to throw.
- Classification rationale: core pricing math is correct; Haiku skipped defensive validation. Classic L1-mostly pattern — spec understood, edge-case hygiene lacking.

### BL-2 — invoice (L2-borderline, 6/10, 60%)

- Tokens: in=9, out=2097, cache_read=22612, cache_create=1227, duration=14.7s, cost=$0.0148
- Representative failures:
  - `percentage discount` — expected 10, got 1000 (misinterpreted discount semantics / units).
  - `throws on percentage discount > 100%` — no validation.
  - `throws on empty items`, `throws on negative quantity` — no validation.
- Classification rationale: got the happy path roughly right but misread a percentage semantic detail and skipped validation. Haiku needs more than the spec alone for consistent financial semantics.

### BL-3 — converter (L1-mostly, 7/8, 88%)

- Tokens: in=9, out=2890, cache_read=22612, cache_create=1227, duration=19.1s, cost=$0.0185
- Failure: `throws on negative amount` — missing validation branch.
- Classification rationale: single missing guard in an otherwise complete implementation.

### BL-4 — prorate (L2-hard, 2/6, 33%)

- Tokens: in=9, out=2023, cache_read=22612, cache_create=1227, duration=16.8s, cost=$0.0139
- All 4 failures: `TypeError: (0 , calculateProration) is not a function`
- Root cause: Haiku exported `prorateCost` / `splitChargesByPeriods` / `calculateDailyRate` instead of the spec's `calculateProration`. Code doesn't link up to the test API at all. Two passing tests are unrelated helpers picked up elsewhere.
- Classification rationale: Haiku invented its own API shape rather than matching the spec's named exports.

### BL-5 — inventory (L2-hard, 0/7, 0%)

- Tokens: in=9, out=2201, cache_read=22612, cache_create=1227, duration=15.2s, cost=$0.0148
- All 7 failures: `TypeError: (0 , createInventory) is not a function`
- Root cause: Haiku produced a class-based `InventoryReservationSystem` design instead of the spec's factory-function `createInventory` API.
- Classification rationale: total API shape mismatch. Spec was ambiguous enough about style that Haiku defaulted to OO.

### ALG-1 — search (L1-saturated, 16/16, 100%)

- Tokens: in=9, out=1935, cache_read=22612, cache_create=1573, duration=15.9s, cost=$0.0139
- No failures.
- Classification rationale: fully solved first-try. This task no longer differentiates methods — Haiku-level capability already saturates it.

### ALG-2 — lru (L2-borderline, 5/7, 71%)

- Tokens: in=9, out=3619, cache_read=22612, cache_create=1225, duration=20.2s, cost=$0.0219
- Failures:
  - `update existing key` — `TypeError: c.size is not a function` (exported a `size` getter where the test calls a method, or vice versa — API mismatch).
  - `throws on capacity < 1` — missing validation.
- Classification rationale: core LRU algorithm correct, two surface-level mismatches.

### ALG-3 — toposort (L2-hard, 2/7, 29%)

- Tokens: in=9, out=1766, cache_read=22612, cache_create=1228, duration=15.5s, cost=$0.0126
- 5 failures: all `TypeError: (0 , topoSort) is not a function`
- Root cause: Haiku exported `toposort` (lowercase) instead of `topoSort` (camelCase). Trivial naming miss that wipes out most of the test file.
- Classification rationale: naming collision with spec; functionally the algorithm is probably fine but the test entry point can't resolve.

### SAAS-1 — rbac (L1-mostly, 12/13, 92%)

- Tokens: in=9, out=3172, cache_read=22612, cache_create=1682, duration=21.7s, cost=$0.0202
- Failure: `public resource accessible to all` — `expected false to be true`. Missed the special-case semantics for public-visibility resources.
- Classification rationale: almost entirely correct RBAC model; one policy edge-case missed.

### SAAS-2 — ratelimit (L2-hard, 1/7, 14%)

- Tokens: in=9, out=2112, cache_read=22612, cache_create=1227, duration=15.9s, cost=$0.0144
- 6 failures: `TypeError: (0 , createRateLimiter) is not a function`
- Root cause: Haiku exported `RateLimiter` (class) + `TokenBucket` instead of the spec's `createRateLimiter` factory. API shape mismatch.
- Classification rationale: same pattern as BL-5 — factory vs class inversion.

### SAAS-3 — account (L2-hard, 0/8, 0%)

- Tokens: in=9, out=2362, cache_read=22612, cache_create=1229, duration=14.7s, cost=$0.0156
- All 8 failures: `TypeError: (0 , createAccount) is not a function` / `(0 , reconstruct) is not a function`
- Root cause: Haiku exported a different API shape (likely class-based `Account` + aggregated namespace) instead of `createAccount` + `applyEvent` + `reconstruct` + `getBalance` functional set.
- Classification rationale: total API shape mismatch; event-sourcing pattern present in the code but not wired to the expected free-function exports.

## 3. Aggregate metrics

| Metric                 | Value         |
|------------------------|--------------:|
| Tasks attempted        | 11            |
| Tasks generated        | 11            |
| Generation failures    | 0             |
| Wall time (generation) | 185.86 s      |
| Wall time (vitest)     | ~0.48 s       |
| Total input tokens     | 99            |
| Total output tokens    | 26,594        |
| Cache read tokens      | ~248,732      |
| Cache create tokens    | ~15,671       |
| Total cost (USD)       | **$0.2034**   |
| Tests passed / total   | **69 / 110**  |
| Overall pass rate      | **62.7%**     |

Per-call input tokens are tiny (9) because the spec is delivered inside the
cached system/prompt path; the real "input" is charged as cache_read/create.
Cost is the authoritative billing signal.

## 4. Conclusions

1. **Only ALG-1 is Haiku-saturated.** One task (1/11) is fully solved first-try
   with no tooling, no feedback loop, no reasoning budget. This is the only task
   that should be classified L1 (easy enough that verification-method
   differentiation is noise).

2. **Three more are near-trivial (L1-mostly, >=86%).** BL-1, BL-3, SAAS-1 fail
   on one or a handful of validation/edge-case tests but the core logic is
   correct. These still differentiate methods somewhat — defensive-programming
   rigor varies across approaches — but the ceiling for differentiation is
   narrow (1-3 tests worth).

3. **Seven tasks remain genuinely hard for one-shot Haiku.** Five of these (BL-4,
   BL-5, ALG-3, SAAS-2, SAAS-3) collapse on **API shape mismatch**, not on
   algorithmic difficulty: Haiku reads an ambiguous spec and picks a different
   export style (class vs factory, `toposort` vs `topoSort`, `prorateCost` vs
   `calculateProration`) than the tests expect. This is a _legitimate_ signal
   of difficulty — matching a spec precisely without iterating is a real
   capability — and the verification methods in phases A–J all get extra turns,
   test feedback, or formal specs to recover from exactly this kind of miss.

4. **No compile failures and no empty responses.** Haiku is reliable at the
   mechanics of "produce a fenced TypeScript block from a spec." The
   differentiation signal comes from spec-compliance fidelity, not from whether
   the model returns code at all.

## 5. Recommendations for differentiation scoring

| Decision | Task | Reason |
|----------|------|--------|
| **Remove from differentiation scoring** | ALG-1 | Haiku one-shot gets 16/16. Any method that fails it is broken; any method that passes it tells us nothing. Keep as a smoke test / baseline sanity check. |
| **Down-weight (cap at 25% of task budget)** | BL-1, BL-3, SAAS-1 | Near-saturated. Method differences are only visible on 1-3 edge-case tests each. Treat these as "validation-rigor" probes, not as full difficulty tasks. |
| **Keep as primary differentiators (full weight)** | BL-2, BL-4, BL-5, ALG-2, ALG-3, SAAS-2, SAAS-3 | 7 tasks that Haiku cannot solve first-try from spec alone. These cleanly separate methods that have test-feedback loops (C_tdd), formal specs (E/F/G), or iterative reasoning (B_effect_xstate, H_consensus) from methods that rely purely on the model's first-try instinct (A_plain_ts). |

Optional addition for a stronger L2 tier if needed: a new task where
spec-ambiguity around API shape is eliminated (explicit named-export signature
in the spec header), forcing the model to solve real semantic difficulty rather
than guess naming.

## Artifacts

- Harness: `scripts/audit-haiku.mts`
- Generated code + per-task raw responses: `experiments/AUDIT_haiku/<TASK>/`
- Generation log: `experiments/AUDIT_haiku/generation-log.json`
- Stderr trace: `experiments/AUDIT_haiku/generation.log`
- Vitest JSON: `experiments/AUDIT_haiku/vitest-results.json`
- Vitest stdout: `experiments/AUDIT_haiku/vitest-output.txt`
- Per-task breakdown: `experiments/AUDIT_haiku/by-task.json`
- Verdict computation: `experiments/AUDIT_haiku/verdict.json`
