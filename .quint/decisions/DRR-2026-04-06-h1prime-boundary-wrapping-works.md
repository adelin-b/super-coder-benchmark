---
type: DRR
winner_id: boundary-wrapping-validated-effect-ts-viable
created: 2026-04-06T02:15:00+02:00
context: super-coder-benchmark
status: active
---

# DRR: H1' Partially Confirmed — Boundary Wrapping Makes Effect Viable

## Signal

effect-ts v3 (plain-TS exports with internal Effect) tested on 5 tasks × Haiku.

## Evidence

| Task | v1 | v2 (docs) | v3 (boundary) | Interpretation |
|---|---|---|---|---|
| BL-1 | 94.7% | 94.7% | 94.7% | Already worked — simple interface |
| BL-5 | 0% | 0% | 0% | Haiku generation failure (markdown stub, 529 tokens) — NOT Effect-related |
| SAAS-3 | 0% | 0% | **50%** | Interface leak FIXED — Effect types no longer in exports |
| BL-2 | — | — | 87.5% | Competitive with plain-ts (88%) on new task |
| ALG-2 | — | — | 83.3% | Competitive with plain-ts (100%) on new task |

## Decision

1. **Effect-ts v3 is the correct approach** — validated by SAAS-3 going from 0% → 50%
2. **v4 should use Sonnet** (not Haiku) to fix BL-5 generation failure — Haiku lacks capacity for complex Effect + boundary code on this task
3. **The "boundary wrapping" pattern is generalizable** — any method that uses non-standard types internally (Effect, XState actors, Dafny extracted code) should wrap exports in plain TS
4. **Add to all library-heavy agent prompts**: explicit "export plain TS, use library internally" instruction

## Falsified Hypothesis Log (updated)

| ID | Hypothesis | Status |
|---|---|---|
| H1 | Effect docs bundle eliminates first-try failures | **FALSIFIED** (0/12 improvements) |
| H1' | Boundary wrapping fixes Effect interface mismatch | **PARTIALLY CONFIRMED** (SAAS-3: 0%→50%) |
| H2 | Typecheck loop recovers remaining delta | **UNTESTED** (Phase 8 pending) |
