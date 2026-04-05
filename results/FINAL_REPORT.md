# Super Coder Benchmark — Final Report

**Generated:** 2026-04-01  
**Repository:** adelin-b/super-coder-benchmark

## Overview

10 verification methods × 11 tasks × 4 bugs each = **440 bug detection checks**  
**1,252 tests** across **124 test files** — all passing  
**44 seeded bugs** total

## Methods

| ID | Method | Stack |
|----|--------|-------|
| A | Plain TypeScript + Vitest | TS, Vitest |
| B | Effect TS + XState v5 | Effect, XState, Vitest |
| C | TDD (Red/Green/Refactor) | TS, Vitest |
| D | Property-Based Testing | fast-check, Vitest |
| E | Dafny Formal Verification | Dafny → TS, Vitest |
| F | Lean 4 Formal Verification | Lean 4 → TS, Vitest |
| G | Coq Formal Verification | Coq → TS, Vitest |
| H | Multi-Model Consensus | 3 variants → consensus, Vitest |
| I | PBT + Effect Hybrid | fast-check, Effect, Vitest |
| J | Dafny + PBT Hybrid | fast-check, Dafny-style, Vitest |

## Tasks (11 total, 4 bugs each)

| Task | Description | Type |
|------|-------------|------|
| BL-1 | Mandate Pricing Engine | Business Logic |
| BL-2 | Invoice Line Item Calculator | Business Logic |
| BL-3 | Currency Converter w/ Rates | Business Logic |
| BL-4 | Proration Calculator | Business Logic |
| BL-5 | Inventory Reservation System | Business Logic |
| ALG-1 | Binary Search (first occurrence) | Algorithm |
| ALG-2 | LRU Cache | Algorithm |
| ALG-3 | Topological Sort | Algorithm |
| SAAS-1 | RBAC Permission Check | SaaS Pattern |
| SAAS-2 | Token Bucket Rate Limiter | SaaS Pattern |
| SAAS-3 | Event-Sourced Account | SaaS Pattern |

## Bug Detection Results (Full Matrix)

### Legend
- ✅ = CAUGHT (test suite detects the bug)
- ❌ = MISSED (bug passes all tests undetected)

All 10 methods share the same test suites, so results are identical across methods **except** for the calibration tasks (BL-1, ALG-1, SAAS-1) where methods had independently written tests.

### Calibration Tasks (independent test suites per method)

#### BL-1: Mandate Pricing Engine
| Bug | A | B | C | D | E | F | G | H | I | J |
|-----|---|---|---|---|---|---|---|---|---|---|
| bug1-percentage-off-by-one | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug2-division-by-zero | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug3-negative-price | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug4-float-accumulation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Caught** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** |

#### ALG-1: Binary Search
| Bug | A | B | C | D | E | F | G | H | I | J |
|-----|---|---|---|---|---|---|---|---|---|---|
| bug1-off-by-one-bounds | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| bug2-infinite-loop-single | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug3-wrong-index-duplicates | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| bug4-integer-overflow-midpoint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Caught** | **3/4** | **3/4** | **3/4** | **2/4** | **3/4** | **3/4** | **3/4** | **3/4** | **3/4** | **2/4** |

#### SAAS-1: RBAC
| Bug | A | B | C | D | E | F | G | H | I | J |
|-----|---|---|---|---|---|---|---|---|---|---|
| bug1-missing-inheritance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug2-empty-role-grants-access | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug3-circular-infinite-loop | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bug4-case-insensitive | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Caught** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** | **4/4** |

### Matrix Tasks (shared test suites — all 10 methods identical)

| Task | bug1 | bug2 | bug3 | bug4 | Caught |
|------|------|------|------|------|--------|
| BL-2 Invoice | ✅ tax-on-discount | ✅ wrong-sign | ❌ rounding-order | ✅ no-discount-cap | **3/4** |
| BL-3 Currency | ✅ no-inverse | ✅ wrong-transitive | ✅ negative-allowed | ✅ stale-not-checked | **4/4** |
| BL-4 Proration | ✅ wrong-clamp | ✅ off-by-one-days | ✅ no-negative-check | ❌ ratio-precision | **3/4** |
| BL-5 Inventory | ✅ no-expiry-check | ✅ confirm-no-delete | ✅ no-positive-check | ❌ double-confirm | **3/4** |
| ALG-2 LRU | ✅ no-refresh-get | ✅ no-eviction | ✅ evict-newest | ❌ update-no-dedup | **3/4** |
| ALG-3 Toposort | ✅ no-cycle-detect | ❌ wrong-order | ✅ self-loop-ignored | ❌ unknown-node | **2/4** |
| SAAS-2 RateLimit | ✅ no-refill | ✅ shared-bucket | ❌ refill-overflow | ✅ no-validation | **3/4** |
| SAAS-3 Account | ✅ no-balance-check | ✅ deposit-subtracts | ✅ events-not-recorded | ✅ no-positive-check | **4/4** |

### Universally Missed Bugs (interesting findings)

| Bug | Why Missed |
|-----|-----------|
| ALG-1:bug1 off-by-one bounds | Semantic no-op — `hi=arr.length` vs `arr.length-1` produces same output |
| BL-2:bug3 rounding-order | No test uses values that expose float accumulation across lines |
| BL-4:bug4 ratio-precision | `r2(totalAmount * r2(ratio))` ≈ `r2(totalAmount * ratio)` for test values |
| BL-5:bug4 double-confirm | No test calls `confirm()` on a nonexistent reservation ID |
| ALG-2:bug4 update-no-dedup | `Map.set` on existing key updates value in-place; order unchanged but tests don't check ordering after update+evict |
| ALG-3:bug2 wrong-order | `.reverse()` in-place corrupts adj list, but test assertions only check relative order which still holds |
| ALG-3:bug4 unknown-node | No test passes edges with nodes not in the node list |
| SAAS-2:bug3 refill-overflow | No test exhausts tokens, waits, then checks that remaining ≤ maxTokens |

**Key insight:** 8 out of 44 bugs (18%) are universally missed. These represent gaps in the shared test suites that _no method_ addresses.

## Aggregate Scores

### Calibration Tasks (where methods differ)

| Method | BL-1 | ALG-1 | SAAS-1 | Calibration Total |
|--------|------|-------|--------|-------------------|
| A Plain TS | 4/4 | 3/4 | 4/4 | **11/12** |
| B Effect+XState | 4/4 | 3/4 | 4/4 | **11/12** |
| C TDD | 4/4 | 3/4 | 4/4 | **11/12** |
| D PBT | 4/4 | 2/4 | 4/4 | **10/12** |
| E Dafny | 4/4 | 3/4 | 4/4 | **11/12** |
| F Lean 4 | 4/4 | 3/4 | 4/4 | **11/12** |
| G Coq | 4/4 | 3/4 | 4/4 | **11/12** |
| H Consensus | 4/4 | 3/4 | 4/4 | **11/12** |
| I PBT+Effect | 4/4 | 3/4 | 4/4 | **11/12** |
| J Dafny+PBT | 4/4 | 2/4 | 4/4 | **10/12** |

### Full Matrix (calibration + shared, per method)

| Method | Calibration | Shared (8 tasks) | Total | % |
|--------|-------------|-------------------|-------|---|
| A Plain TS | 11/12 | 25/32 | **36/44** | 81.8% |
| C TDD | 11/12 | 25/32 | **36/44** | 81.8% |
| E Dafny | 11/12 | 25/32 | **36/44** | 81.8% |
| F Lean 4 | 11/12 | 25/32 | **36/44** | 81.8% |
| G Coq | 11/12 | 25/32 | **36/44** | 81.8% |
| H Consensus | 11/12 | 25/32 | **36/44** | 81.8% |
| B Effect+XState | 11/12 | 25/32 | **36/44** | 81.8% |
| I PBT+Effect | 11/12 | 25/32 | **36/44** | 81.8% |
| D PBT | 10/12 | 25/32 | **35/44** | 79.5% |
| J Dafny+PBT | 10/12 | 25/32 | **35/44** | 79.5% |

## Analysis

### Why Most Methods Score Identically

The matrix tasks (BL-2 through SAAS-3) use **shared test suites** — every method gets the same tests. This means the shared tasks don't differentiate methods at all. Only the 3 calibration tasks (BL-1, ALG-1, SAAS-1) where methods had independently-written tests produce meaningful differences.

**This is the benchmark's main limitation right now.**

### Where Methods Actually Differ (Calibration)

Only **ALG-1 bug3 (wrong-index-duplicates)** differentiates:
- D (PBT) and J (Dafny+PBT) MISS it — random sorted arrays don't reliably hit the duplicate structure needed
- All other methods CATCH it via handcrafted `[1,2,2,2,3]` test case

### Generation Reliability (from calibration phase)

| Method | First-Try Pass? | Notes |
|--------|----------------|-------|
| A, C, E, F, G | ✅ Yes | Simple/clean code |
| H | ✅ Yes | 3× code but reliable |
| B, D, I, J | ❌ Needed retries | FiberFailure (B/I), float edge cases (D/J) |

## Conclusions

1. **Plain TypeScript + good example tests is hard to beat.** Method A scores maximum with minimum complexity.

2. **PBT has a real blind spot** for structural bugs requiring specific data shapes. It excels at mathematical properties but misses bugs that need handcrafted examples.

3. **18% of seeded bugs are invisible** to all test suites — they require either: (a) more targeted test cases, (b) formal verification of specific properties, or (c) bugs that are genuinely semantic no-ops.

4. **Shared test suites eliminate differentiation.** The benchmark's next evolution MUST have each method generate its own tests independently.

## What's Needed Next

1. **Independent test generation per method** — the single biggest improvement. Each method should produce its own tests from the spec alone.
2. **More calibration tasks** — expand the 3 independently-tested tasks to all 11.
3. **Harder bugs** — the 8 universally-missed bugs show the ceiling; design bugs that only PBT or formal methods can catch.
4. **React UI track** — untested domain.
5. **Real-world tasks** (SWE-bench style) — move beyond synthetic specs.
