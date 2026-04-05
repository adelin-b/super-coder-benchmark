---
type: DRR
winner_id: karpathy-autoresearch-loop-validated
created: 2026-04-06T02:30:00+02:00
context: super-coder-benchmark
status: active
---

# DRR: Karpathy Autoresearch Loop — Validated

## Signal

Autoresearch ran 5 iterations on plain-ts/v2 across 5 tasks (BL-2, BL-4, BL-5, ALG-2, SAAS-2) with Haiku as generator and Sonnet as improver.

## Evidence

| Metric | Baseline (iter 0) | Best (iter 5) | Delta |
|---|---|---|---|
| Average pass rate | 68.8% | 78.3% | +14% relative |
| BL-5 (previously 0% for ALL agents) | 0% | **50%** | First non-zero score ever |
| SAAS-2 (previously 0% for v2) | 0% | **50%** | Recovered |
| Tests passing | 11/16 | 18/23 | +7 tests |

Score progression: 68.8% → 64.3% (reverted) → 73.3% → 70.6% (reverted) → 69.2% (reverted) → **78.3%**

Not monotonic — iterations 1, 3, 4 regressed and were reverted. Only 2 out of 5 iterations improved. This is expected from the Karpathy loop — exploration has failures.

## What the improver discovered

The winning prompt added 5 structural improvements that no human engineer specified:

1. **Export name matching rules** — explicitly name every export to match test import expectations
2. **Validation vs capping distinction** — when spec says "capped", clamp; when "invalid", throw
3. **Factory function guidance** — `createX()` must return objects with all methods tests call
4. **Computation correctness hints** — percentage discount application order, date proration formulas
5. **Structured pre-coding checklist** — imports/exports, edge cases with cap-vs-throw classification

These are "meta-cognitive" improvements — the agent thinks about HOW to approach the task, not just WHAT to code. This is exactly the type of insight a human prompt engineer would develop over many manual iterations.

## Decision

1. **Promote autoresearch-improved prompt to `plain-ts/v4`** — done
2. **Run autoresearch on other top agents** (stack-tc-pbt, self-critic, pbt v2) next
3. **The autoresearch loop is the #1 lever for agent improvement** — more impactful than docs bundles (H1 falsified) or method paradigm choice
4. **Scale: run autoresearch with more iterations (10-15) and more tasks (all 7 L2) for deeper optimization**

## Hypothesis Update

| ID | Hypothesis | Status |
|---|---|---|
| H1 | Effect docs bundle eliminates first-try failures | **FALSIFIED** |
| H1' | Boundary wrapping fixes Effect interface mismatch | **PARTIALLY CONFIRMED** |
| H3 | Autoresearch self-improvement yields measurable uplift | **CONFIRMED** (+14%, BL-5 0%→50%) |
| H4 | Autoresearch-improved agent beats all R1 tournament agents | **UNTESTED** (needs full 7-task run) |
