---
type: DRR
winner_id: pivot-to-plain-ts-variants-and-structural-agents
created: 2026-04-06T01:30:00+02:00
context: super-coder-benchmark
status: active
---

# DRR: H1 Falsified — Effect Docs Bundle Insufficient

## Signal

Phase 7c experiment: 12 runs of effect-ts v1 vs v2 (+ Effect quickstart bundle) across BL-1, BL-5, SAAS-3 on Haiku and Sonnet.

**Result: ZERO improvement.** v2 = v1 on all 12 runs.

## Root Cause Analysis

The failure mode is NOT what we expected (FiberFailure confusion). It's structural:

1. **BL-5 and SAAS-3**: Effect agent produces `Effect.succeed(...)`, `pipe(...)`, `Effect.fail(...)` exports. The test harness expects plain TS functions that return values directly. The code doesn't even compile against the tests. Docs can't fix an interface mismatch.

2. **BL-1**: Works (18/19) because the pricing task is simple enough that Effect wrapping still produces compatible exports. But v2 doesn't improve over v1 because v1 already handles BL-1 fine.

3. **The FiberFailure issue** documented in the original benchmark (results.json: "FiberFailure wrapping required fix") was a RUNTIME problem during the calibration phase — the human manually fixed it. The doc bundle can't fix a structural API mismatch that prevents compilation.

## Decision

**Pivot tournament focus to agents that produce plain-TS-compatible code.** Effect-ts is fundamentally handicapped by the interface mismatch. It needs either:
- v3: explicit "wrap in plain TS exports" instruction
- v4: typecheck loop that feeds compile errors back
- Neither is worth pursuing BEFORE we establish which plain-TS agents win

**Immediate action:** Run Tournament R1 on the agents most likely to differentiate:
- plain-ts/v1, v2 (edge-cases), v3 (self-review)
- tdd/v2 (test-case enumeration)
- pbt/v2 (fast-check bundle)
- self-critic/v1 (self-critique loop)
- stack-tc-pbt/v1 (combo: plain-ts + PBT + self-review)

These 7 agents × 7 L2 tasks × Haiku = 49 runs. Parallelizable across 4-5 sub-agents.

## Falsified Hypothesis Log

| ID | Hypothesis | Status | Evidence |
|---|---|---|---|
| H1 | Effect docs bundle eliminates FiberFailure first-try failures | **FALSIFIED** | 0/12 improvements in v1-vs-v2-comparison.json |
| H1' | Effect's real problem is interface mismatch, not docs | **CONFIRMED** | BL-5/SAAS-3 fail at compile time |

## Review Trigger

Re-evaluate Effect-ts once typecheck loop (Phase 8) is implemented. At that point, effect-ts/v4 (docs + typecheck) becomes testable.
