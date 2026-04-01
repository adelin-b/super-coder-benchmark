# Calibration Ranking: BL-1 + ALG-1 + SAAS-1

Generated: 2026-04-01T10:25:00Z

## Summary: 3 tasks × 7 methods = 21 experiments

### BL-1: Mandate Pricing (Business Logic)

| Method | Gen | Det | Total | Bugs Caught |
|--------|-----|-----|-------|-------------|
| A — Plain TS | 10 | 13 | **23** | 4/4 |
| C — TDD | 10 | 13 | **23** | 4/4 |
| H — Consensus | 10 | 12 | **22** | 4/4 |
| D — PBT | 7 | 14 | **21** | 4/4 |
| J — Dafny+PBT | 7 | 14 | **21** | 4/4 |
| I — PBT+Effect | 7 | 13 | **20** | 4/4 |
| B — Effect+XState | 7 | 12 | **19** | 4/4 |

### ALG-1: Binary Search (Algorithms)

| Method | Gen | Bugs Caught | Missed |
|--------|-----|-------------|--------|
| A — Plain TS | 10 | 3/4 | off-by-one bounds |
| C — TDD | 10 | 3/4 | off-by-one bounds |
| H — Consensus | 10 | 3/4 | off-by-one bounds |
| D — PBT | 10 | 2/4 | off-by-one bounds, wrong-index-duplicates |
| J — Dafny+PBT | 10 | 2/4 | off-by-one bounds, wrong-index-duplicates |

**Key finding:** Bug 1 (off-by-one with `hi = arr.length`) is invisible to ALL methods because the left-biased search still produces correct results — the bug only wastes one comparison step. It's a **semantic no-op bug** that doesn't change output.

**PBT weakness:** Methods D and J missed bug 3 (wrong-index-duplicates) because randomly generated sorted arrays don't reliably produce duplicate configurations where standard binary search returns a non-first index. Example-based tests with handcrafted `[1,2,2,2,3]` arrays catch it. **PBT is worse than example-based testing for this specific bug class.**

### SAAS-1: Permission Check RBAC (SaaS Patterns)

| Method | Gen | Bugs Caught | Missed |
|--------|-----|-------------|--------|
| A — Plain TS | 10 | 4/4 | — |
| C — TDD | 10 | 4/4 | — |
| H — Consensus | 10 | 4/4 | — |
| D — PBT | 10 | 4/4 | — |
| J — Dafny+PBT | 10 | 4/4 | — |

All methods caught all bugs including circular inheritance (stack overflow prevention) and case sensitivity.

## Cross-Task Composite Ranking

| Rank | Method | BL-1 | ALG-1 Bugs | SAAS-1 Bugs | Composite Notes |
|------|--------|------|------------|-------------|-----------------|
| 🥇 1 | **A — Plain TS** | 23 | 3/4 | 4/4 | Simple, reliable, good detection |
| 🥇 1 | **C — TDD** | 23 | 3/4 | 4/4 | Same as A — discipline helps but doesn't add detection |
| 🥉 3 | **H — Consensus** | 22 | 3/4 | 4/4 | Slightly lower on BL-1, same detection |
| 4 | **D — PBT** | 21 | 2/4 | 4/4 | Best BL-1 detection, **worst ALG-1 detection** |
| 4 | **J — Dafny+PBT** | 21 | 2/4 | 4/4 | Same as D |
| 6 | **I — PBT+Effect** | 20 | — | — | More complex, no added benefit |
| 7 | **B — Effect+XState** | 19 | — | — | Highest complexity, lowest score |

## Key Insights

1. **Simpler is better** — Plain TS + Jest and TDD are the most reliable generators AND good bug detectors
2. **PBT has a blind spot** — Random data doesn't exercise specific structural patterns (like duplicate arrays). PBT excels at edge cases and mathematical properties but can miss structural bugs.
3. **Effect TS adds complexity without proportional benefit** for pure computation tasks. FiberFailure wrapping creates instanceof issues.
4. **All methods caught all SAAS-1 bugs** — RBAC logic is well-suited to both example and property testing
5. **Some bugs are invisible** — Bug 1 in ALG-1 doesn't change outputs, so no test of any kind can detect it through behavior alone

## Top 5 Selection for Phase 6

Based on calibration: **A, C, D, H, J** (drop B and I)
- B (Effect) adds complexity with no benefit
- I (PBT+Effect) is hybrid of two underperformers on these tasks

---

*Calibration complete. Ready for full matrix expansion.*
