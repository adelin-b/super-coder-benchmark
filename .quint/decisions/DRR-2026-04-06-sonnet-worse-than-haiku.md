---
type: DRR
winner_id: haiku-preferred-for-one-shot-generation
created: 2026-04-06T02:45:00+02:00
context: super-coder-benchmark
status: active
---

# DRR: Sonnet Worse Than Haiku on One-Shot Generation

## Signal

R2 tournament: 21 runs (top 3 R1 agents × 7 L2 tasks × Sonnet). Compared against same agents on Haiku from R1.

## Evidence

| Metric | Haiku | Sonnet |
|---|---|---|
| Avg pass rate (top 3 agents) | 49.0% | 31.0% |
| Full passes (100%) | 1/21 | 0/21 |
| Avg duration per run | 14.4s | 29.5s |
| Avg tokens_out per run | 1,841 | 2,293 |

Per-task regressions (Sonnet vs Haiku):
- ALG-2: ALL agents dropped (1.00→0.67, 0.86→0.67, 0.83→0.67)
- ALG-3: ALL agents dropped to 0%
- BL-4: plain-ts/v2 dropped 67%→0%

Per-task improvements (Sonnet vs Haiku):
- SAAS-2: plain-ts/v2 improved 0%→50%
- SAAS-3: plain-ts/v2 improved 0%→50% (new)

## Interpretation

Sonnet "overthinks" on one-shot spec-driven tasks:
1. Generates more complex abstractions that don't match test interface expectations
2. Uses more tokens for longer code that has more surface area for bugs
3. The tasks are simple enough that Haiku's simpler, more direct approach works better

This is NOT a general statement about Sonnet's capability — it's specific to **one-shot generation without feedback**. Sonnet's added reasoning capacity is wasted when it can't iterate. With a typecheck feedback loop, Sonnet's ability to understand complex errors and refactor would likely outperform Haiku.

## Decision

1. **Use Haiku for one-shot screening runs** (R1) — cheaper and better
2. **Reserve Sonnet for iterative agents** (typecheck loop, autoresearch improver) where its reasoning shines
3. **This confirms the iteration hypothesis**: bigger models help MORE with feedback than without
4. **Don't run Opus one-shot** — if Sonnet regresses vs Haiku, Opus likely would too. Opus should only be tested with full iteration loops.
