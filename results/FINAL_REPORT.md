# Super Coder Benchmark — Final Report

**Generated:** 2026-04-01
**Repository:** adelin-b/super-coder-benchmark

## Overview

10 verification methods tested across 11 tasks in 4 tracks (Business Logic, Algorithms, SaaS, React UI — UI pending).

- **1,120 tests** across **110 test files** — all passing
- **21 seeded bugs** across 11 tasks
- **Formal verification:** Dafny (3 verified), Coq (3 theorems proved), Lean 4 (formalized)

## Methods

| ID | Method | Stack | Complexity |
|----|--------|-------|------------|
| A | Plain TypeScript + Vitest | TS, Vitest | ⭐ Low |
| B | Effect TS + XState v5 | Effect, XState, Vitest | ⭐⭐⭐ High |
| C | TDD (Red/Green/Refactor) | TS, Vitest | ⭐ Low |
| D | Property-Based Testing | fast-check, Vitest | ⭐⭐ Medium |
| E | Dafny Formal Verification | Dafny → TS, Vitest | ⭐⭐⭐ High |
| F | Lean 4 Formal Verification | Lean 4 → TS, Vitest | ⭐⭐⭐ High |
| G | Coq Formal Verification | Coq → TS, Vitest | ⭐⭐⭐ High |
| H | Multi-Model Consensus | 3 variants → consensus, Vitest | ⭐⭐ Medium |
| I | PBT + Effect Hybrid | fast-check, Effect, Vitest | ⭐⭐⭐ High |
| J | Dafny + PBT Hybrid | fast-check, Dafny-style, Vitest | ⭐⭐ Medium |

## Tasks

### Track 1: Business Logic (5 tasks)
| Task | Description | Bugs Seeded |
|------|-------------|-------------|
| BL-1 | Mandate Pricing Engine | 4 (off-by-one, div-zero, negative, float accumulation) |
| BL-2 | Invoice Line Item Calculator | 2 (tax-on-discount, wrong-sign) |
| BL-3 | Currency Converter | 1 (no-inverse-rate) |
| BL-4 | Proration Calculator | 1 (no-date-clamping) |
| BL-5 | Inventory Reservation | 1 (no-expiry-check) |

### Track 2: Algorithms (3 tasks)
| Task | Description | Bugs Seeded |
|------|-------------|-------------|
| ALG-1 | Binary Search (first occurrence) | 4 (off-by-one, infinite-loop, wrong-index, overflow) |
| ALG-2 | LRU Cache | 1 (no-refresh-on-get) |
| ALG-3 | Topological Sort | 1 (no-cycle-detection) |

### Track 3: SaaS Patterns (3 tasks)
| Task | Description | Bugs Seeded |
|------|-------------|-------------|
| SAAS-1 | RBAC Permission Check | 4 (no-inheritance, empty-grants-all, circular-infinite-loop, case-insensitive) |
| SAAS-2 | Token Bucket Rate Limiter | 1 (no-refill) |
| SAAS-3 | Event-Sourced Account | 1 (no-balance-check) |

## Results Summary

### BL-1 (Deepest analysis — 4 bugs × 10 methods)

| Method | Gen Score | Det Score | Total | 1st Try | Bugs |
|--------|-----------|-----------|-------|---------|------|
| A — Plain TS | 10 | 13 | **23** | ✅ | 4/4 |
| C — TDD | 10 | 13 | **23** | ✅ | 4/4 |
| H — Consensus | 10 | 12 | **22** | ✅ | 4/4 |
| D — PBT | 7 | 14 | **21** | ❌ | 4/4 |
| J — Dafny+PBT | 7 | 14 | **21** | ❌ | 4/4 |
| I — PBT+Effect | 7 | 13 | **20** | ❌ | 4/4 |
| B — Effect+XState | 7 | 12 | **19** | ❌ | 4/4 |
| E — Dafny | 10 | 13 | **23** | ✅ | 4/4 |
| F — Lean 4 | 10 | 13 | **23** | ✅ | 4/4 |
| G — Coq | 10 | 13 | **23** | ✅ | 4/4 |

### ALG-1 (Binary Search — 4 bugs)

| Method | Bugs Caught | Notable Miss |
|--------|-------------|-------------|
| A, C, H, E, F, G, B, I | 3/4 | off-by-one (semantic no-op) |
| D, J (PBT methods) | 2/4 | + wrong-index-duplicates |

**Key finding:** PBT missed the duplicate-index bug because random sorted arrays don't reliably produce the right duplicate structures.

### All Other Tasks (1-2 bugs each)

**All methods caught all bugs** across BL-2 through BL-5, ALG-2, ALG-3, SAAS-1 through SAAS-3.

## Key Insights

### 1. Simplicity Wins on Generation Reliability
Methods A (Plain TS), C (TDD), and E/F/G (formal + TS wrapper) all pass first try. Complex methods (B, D, I, J) needed retries due to:
- Effect TS: FiberFailure wrapping breaks `instanceof` checks
- PBT: Floating-point edge cases in strict equality assertions

### 2. PBT Has a Blind Spot for Structural Bugs
Property-based testing excels at mathematical invariants but misses bugs that require specific data structures (e.g., arrays with duplicates at specific positions). **Example-based tests outperform PBT for structural correctness.**

### 3. Formal Verification Proves Properties But Tests Still Needed
Dafny, Lean, Coq prove mathematical properties (price ≥ net, commission ≥ 0, zero-commission identity). But the TS runtime tests still catch all bugs — formal verification adds confidence, not detection power for this task set.

### 4. Some Bugs Are Invisible
ALG-1 bug 1 (off-by-one with `hi = arr.length`) doesn't change outputs for the left-biased search. No testing method can detect it through behavior alone — only code review or formal specification of the algorithm's loop invariant could catch it.

### 5. Complexity Tax Is Real
Effect TS + XState (Method B) adds 3× the code for the same implementation, introduces FiberFailure debugging overhead, and scores lowest overall. The pattern may shine for distributed systems but hurts for pure computation.

## Method Rankings (Overall)

| Rank | Method | Strengths | Weaknesses |
|------|--------|-----------|------------|
| 🥇 | **A — Plain TS** | Simple, reliable, good detection | No mathematical guarantees |
| 🥇 | **C — TDD** | Disciplined, same quality as A | No added detection over A |
| 🥇 | **E/F/G — Formal** | Proven invariants + good tests | High setup cost, same detection |
| 4 | **H — Consensus** | High reliability | 3× code for same result |
| 5 | **D — PBT** | Best detection quality (shrunk examples) | Misses structural bugs, harder to write |
| 5 | **J — Dafny+PBT** | Strong invariants | Same PBT blind spot |
| 7 | **I — PBT+Effect** | Typed errors + properties | Complexity of both without benefit of either |
| 8 | **B — Effect+XState** | Typed error channels | Highest complexity, lowest score |

## What's Next

1. **Track 4 (React UI)** — not yet implemented
2. **Track 5 (SWE-bench)** — requires real-world repos
3. **Method improvement** — iterate on each method's weaknesses
4. **More bugs per task** — current tasks have 1-4 bugs; more nuanced bugs would differentiate methods better
5. **Independent agent generation** — have each method implemented by a fresh AI agent (not shared code)

---

*This benchmark measures the testing/verification METHOD, not the implementation quality. All methods use correct implementations — the differentiation is in how well each method's tests catch seeded bugs.*
