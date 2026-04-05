---
type: DRR
winner_id: four-axis-versioned-agent-framework-with-tournament-ranking
created: 2026-04-06T00:57:00+02:00
context: super-coder-benchmark
status: draft-pending-mcp-import
note: "Drafted outside quint-code MCP (tools not hot-loaded in session). Import via /q-onboard after Claude Code restart."
---

# DRR: Super Coder Benchmark — Agent Framework Direction

## Problem (P1)

**Signal.** The super-coder-benchmark compares 10 verification methods across 11 tasks with seeded bugs, but the scoring is saturated. Top-3 methods all reach ~82% total score; only 1 out of 44 bugs differentiates methods (ALG-1 bug3). The user's actual goal is not "which method wins on these synthetic tasks?" but **"how do I build an agent that writes code without bugs, can map all relevant information, and iterate?"**.

**Evidence.**
- `results/FINAL_REPORT.md`: ~82% top, 79.5% bottom, spread of 2.3 points
- `results/results.json`: 9/10 methods identical on the full matrix; only BL-1 calibration shows gen_score variation due to retry-triggered toolchain bugs (Effect FiberFailure wrapping)
- Phase 6.5 Part A audit (Haiku one-shot, 2026-04-06): only 1/11 tasks fully saturated (ALG-1, 100%), 3/11 near-saturated, 7/11 still discriminate (BL-4 33%, BL-5 0%, ALG-3 29%, SAAS-2 14%, SAAS-3 0%)
- Phase 6.5 Part B: 35 real external benchmarks verified live (SWE-PolyBench TS, SWE-Lancer Diamond, Web-Bench, BugsJS, SWE-bench Multilingual, CWEval-bench, SWE-bench Live, Multi-SWE-bench) — harder tasks exist and are reachable

**Root causes of saturation.**
1. **Static comparison** of paradigms, not of agents. Methods are pinned prompts, not configurable.
2. **Shared test suites** across 8/11 tasks → no per-method differentiation possible on those tasks.
3. **One-shot runs** — no iteration loop, so agents can't recover from their own errors.
4. **Minimal docs bootstrapping** — methods that rely on library-specific idioms (Effect, XState, Dafny, Lean, Coq, fast-check) fail on toolchain quirks their training set doesn't teach.
5. **Synthetic textbook tasks** — all 11 are canonical problems in LLM training sets.
6. **Hand-seeded bugs** — 44 total, 18% universally undetectable → ceiling is artificial.

## Characterization (C1) — What Matters

Dimensions on which we must evaluate any solution direction, each weighted:

| # | Dimension | Weight | Scale | Rationale |
|---|---|---|---|---|
| 1 | Discrimination power | high | bits of score variance across methods | If methods tie, the benchmark is useless |
| 2 | Prevention measurability | high | bugs escaped / mutations survived | Actual "bug-free" metric, not just detection |
| 3 | Iteration capture | high | turns / feedback loops supported | User's explicit goal #3 |
| 4 | Context-mapping capture | high | retrieval recall/precision measurability | User's explicit goal #2 |
| 5 | Realism | medium | fraction of tasks from real repos | Generalization to prod |
| 6 | Contamination resistance | medium | fraction post-training-cutoff | Stale benchmarks give false confidence |
| 7 | Economic ranking | medium | $/bug prevented or tokens/pass | Prod decisions need cost axis |
| 8 | Reproducibility | medium | can re-run same config → same result | Scientific audit trail |
| 9 | Implementation cost | low | weeks of refactor | Must be achievable incrementally |

## Solution Variants (S1–S7)

All seven were brainstormed across prior turns:

### S1 — Keep current benchmark, just add harder tasks
Add 16 tasks from real benchmarks (Phase 9). Leave methods as-is.
- **Pro:** minimal refactor
- **Con:** still doesn't capture iteration or docs uplift; doesn't improve discrimination fundamentally

### S2 — Compose methods into a single stack
Replace "A vs B vs C" with "A + B + C pipeline". Types → PBT → formal → consensus stacked.
- **Pro:** directly targets "bug-free" via defense-in-depth
- **Con:** loses per-method attribution; can't answer "which layer helped?"

### S3 — Agent loop wrapper around existing methods
Add typecheck+test feedback loop on top of each method. Keep prompts, add iteration.
- **Pro:** cheap to implement; captures iteration
- **Con:** doesn't address docs bootstrapping; no versioning of improvements

### S4 — Four-axis versioned agent framework ★
Methods become (method × version × tools × context_bundle) configurations. Model is runtime axis. Tournament over all configs on all tasks × all models, with Pareto frontier.
- **Pro:** captures all three user goals (bug-free via composition, context via bundles, iteration via loops). Every improvement is a versioned artifact with measurable delta. Combinations become first-class manifests.
- **Con:** largest refactor. Requires runner + registry + bundles + loops + scoring v2.

### S5 — Pure mutation testing benchmark
Replace hand-seeded bugs with Stryker auto-mutations, measure kill rate per method.
- **Pro:** eliminates human bug-selection bias; scales to thousands of bugs
- **Con:** doesn't capture generation ability, only detection; doesn't address tasks-too-easy

### S6 — SWE-bench-only rebuild
Drop synthetic tasks entirely, rebuild on SWE-PolyBench + SWE-bench Live tasks.
- **Pro:** maximal realism
- **Con:** loses the calibration reference point; ingestion of SWE-bench format is nontrivial; verification methods that rely on formal specs can't operate on real-repo tasks

### S7 — Self-improving agent loop (Karpathy autoresearch)
Time-boxed loop: agent modifies its own prompt/tools, measures scalar metric, iterates.
- **Pro:** aligned with research frontier; self-improvement target
- **Con:** requires everything in S4 as prerequisite; too ambitious for current state

## Comparison (CMP1) — Pareto Analysis

| Variant | Discrim | Preven | Iter | Ctx | Real | Contam | Econ | Repro | Cost | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 2/5 | 2/5 | 0/5 | 0/5 | 4/5 | 3/5 | 1/5 | 4/5 | 5/5 | 21/45 |
| S2 | 3/5 | 4/5 | 1/5 | 1/5 | 2/5 | 2/5 | 2/5 | 3/5 | 3/5 | 21/45 |
| S3 | 4/5 | 3/5 | 5/5 | 1/5 | 2/5 | 2/5 | 3/5 | 3/5 | 4/5 | 27/45 |
| **S4** | **5/5** | **5/5** | **5/5** | **4/5** | **3/5** | **3/5** | **5/5** | **5/5** | **2/5** | **37/45** |
| S5 | 3/5 | 5/5 | 1/5 | 1/5 | 2/5 | 5/5 | 2/5 | 4/5 | 3/5 | 26/45 |
| S6 | 5/5 | 4/5 | 3/5 | 5/5 | 5/5 | 4/5 | 4/5 | 2/5 | 1/5 | 33/45 |
| S7 | 5/5 | 5/5 | 5/5 | 5/5 | 3/5 | 3/5 | 5/5 | 2/5 | 0/5 | 33/45 |

**Weak-link analysis (WLNK).** S4's weakest link is implementation cost (2/5). All other variants have weak links in the **high-weight** dimensions (discrimination, prevention, iteration, context), which are the user's explicit goals. By FPF weakest-link assurance, S4 wins because its weak link is in a low-weight dimension.

**Congruence.** S4 is additive to S1 (hardened tasks slot into the framework), S3 (loops become one axis), S5 (mutation testing becomes a verification oracle), and S6 (SWE-bench tasks become `hardened tier` tasks in the framework). Only S2 and S7 are partially mutually exclusive with S4 as an explicit primary — but both can be expressed as *combinations* within S4 (S2 = a multi-layer combo manifest, S7 = a future self-modifying agent).

## Decision (D1)

**Winner:** `four-axis-versioned-agent-framework-with-tournament-ranking` (S4)

**Contract.**

1. **Agent identity = (method, version, tools, context_bundle)**. Model is runtime parameter, orthogonal.
2. **Registry at `agents/<method>/v<N>/manifest.yml`**. Each version has `parent`, `rationale`, `changelog`, and full config.
3. **Runner at `infra/agent-runner.mts`** (generalized from `scripts/audit-haiku.mts`). Loads manifest, injects bundle into systemPrompt, passes tools to SDK, records full trajectory JSON.
4. **Context bundles under `context-bundles/<name>/`**. Fetched from official docs, distilled ≤2k tokens, versioned with upstream hash.
5. **Loops under `infra/loops/`**: typecheck, vitest, dafny, lean, coq, lint, mutation. Each exposes a `run(code) → {passed, feedback}` interface and feeds back as a user message in multi-turn runs.
6. **Scoring v2**: (prevention_rate, tokens, turns, wall_time) quadruple. Prevention via mutation testing on generated code, not hand-seeded bugs alone.
7. **Tournament 3-round structure**: Haiku screening → Sonnet elimination → Opus championship. Pareto frontier per model tier for economic ranking.
8. **Hardened tier**: 16 tasks extracted from SWE-PolyBench TS, Web-Bench, BugsJS, SWE-Lancer Diamond, CWEval-bench, SWE-bench Live, per the Phase 6.5 Part B catalog.
9. **Combinations are first-class manifests**, not a separate concept. Includes `stack-types+tc+pbt`, `effect-full-stack`, `dafny-then-extract`, `tier-consensus`, `spec-then-impl`, `self-critic-loop`, `mutation-guarded-pbt`.

## Supporting Hypotheses (to validate in Phase 7c pilot)

- **H1:** `effect-ts/v2` (v1 + Effect quickstart + FiberFailure pitfalls bundle) will score ≥ `plain-ts/v1` on BL-1 and BL-5 on Haiku one-shot, whereas `effect-ts/v1` scored below `plain-ts/v1` due to FiberFailure wrapping bugs.
  - **Falsifier:** v2 scores no higher than v1 on those tasks → hypothesis falsified; docs don't help Effect bootstrap, so the v1 failure mode is deeper than missing context.
- **H2:** Adding a typecheck loop (`effect-ts/v3 = v2 + typecheck`) will recover at least 50% of the remaining delta vs `plain-ts/v1` baseline.
- **H3:** On the hardened tier (Phase 9 tasks), methods with iteration loops will beat their non-iterating counterparts by ≥ 10 prevention points absolute. If false, the investment in loop infrastructure is not justified for real-repo tasks.

## Execution Plan (supersedes previous Phase roadmap)

| Phase | Deliverable | Prerequisite |
|---|---|---|
| 7a | `infra/agent-runner.mts` generalized from Phase 6.5 harness | Phase 6.5 complete ✓ |
| 7b | 10 existing methods migrated to `agents/<id>/v1/manifest.yml` | 7a |
| 7c | `context-bundles/effect-quickstart/` + `agents/effect-ts/v2/manifest.yml` + H1 validation run | 7b |
| 8 | Loops: typecheck, vitest | 7a |
| 9 | Hardened tier ingestion (16 tasks from real benchmarks) | 7a |
| 10 | Combination manifests (7 combos) | 8 |
| 11 | Tournament R1 (Haiku screening) | 7b + 8 + 9 + 10 |
| 12 | Tournament R2 (Sonnet elimination) | 11 |
| 13 | Tournament R3 (Opus championship) + final leaderboards + HTML dashboard | 12 |

## Rationale

S4 is the only variant whose weak link is in a low-weight dimension. It subsumes S1, S3, S5, and S6 as special cases (hardened tasks, loops, mutation testing, SWE-bench tasks all slot in as configuration points or task sources). S2 and S7 are expressible as combinations within S4. The implementation cost is front-loaded in Phase 7a (one runner file, ~150 LoC extension of an already-working harness) but amortized across all subsequent phases.

## Review Triggers (quint-code refresh conditions)

This decision should be re-evaluated if:
- Phase 7c H1 validation fails (effect-ts v2 not > v1) — indicates docs-uplift hypothesis is wrong
- Phase 11 R1 tournament shows < 5 points spread across top 10 configs — indicates the framework doesn't discriminate any better than the original benchmark
- A new upstream benchmark emerges with a fundamentally different structure (e.g., a TypeScript-native SWE-bench variant)
- User explicit signal (new constraint, budget change, goal shift)

---

*Drafted 2026-04-06 as markdown artifact outside quint-code MCP. Import via `/q-onboard` after Claude Code restart to index into `.quint/quint.db`.*
