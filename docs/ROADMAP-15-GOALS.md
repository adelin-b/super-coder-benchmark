# 15 Research Goals — super-coder-benchmark

**Status**: proposal awaiting user selection
**Date**: 2026-05-18
**Method**: h-reason (frame → explore → compare). Each goal has a falsifiable hypothesis, a measurement, a weakest-link, and a rough cost. Pick the ones you want to pursue. Numbers like `33%`, `61.6%`, `100%` come from prior commits / `autoresearch/*/history.json`.

## Current state (one-paragraph context)

Sonnet-vanilla scores ~100% on most existing tasks. The only category that breaks it: **TS type-level tasks** (61.6% overall, WEB-TS-4 = 0%). Effect-TS / XState / Quint methods consistently *hurt* (effect-god-v3 stuck at 33% across 4 hard TS-type tasks for 5+ iterations of autoresearch). The benchmark is starting to ceiling — we need harder, more realistic axes. The most promising under-explored axes are: **semantic-mirage bugs** (looks right, isn't), **log-driven debugging**, **distributed-protocol verification via Quint**, and **multi-turn agent tasks with real toolchains**.

---

## Goal taxonomy

Goals are tagged:
- `[BENCH]` new benchmark category
- `[METHOD]` new method/agent
- `[INFRA]` benchmark infrastructure
- `[FORMAL]` formal-verification integration
- `[SKILL]` skill or prompt artifact
- `[META]` measurement / analysis

Difficulty: S (1-day) / M (1-week) / L (>1 week)

---

## The 15 goals

### G1. [BENCH][M] SEMANTIC-MIRAGE task set — Effect-TS/XState/Quint plausibility bugs
**Hypothesis**: LLMs ship code that uses correct *vocabulary* of FX-libraries but wrong *semantics* — e.g., `Effect.gen` body with raw `await`, XState `guard` with side effects, Quint `val` that references state. Tests catch behavior, code review needs targeted lens.
**Measure**: 12 reference tasks (4 per lib). For each: seed K mirages of distinct types. Score = (bugs caught / bugs seeded). Compare vanilla vs vanilla+`spot-semantic-mirage` skill.
**Weakest link**: writing tests that fail *behaviorally* (not just by syntax) for each mirage type.
**Why now**: most common real-world LLM bug class, no benchmark exists.

### G2. [SKILL][S] `spot-semantic-mirage` skill — step-by-step plausibility-bug detector
**Hypothesis**: A library-aware checklist (Effect mode/yield discipline, XState guard purity, Quint mode rules) raises catch-rate by ≥30pp on G1 tasks.
**Measure**: A/B on G1 — vanilla vs vanilla+skill. Track per-category catch-rate + false-positive rate.
**Weakest link**: avoiding turning the skill into a syntactic linter (must reason about semantics).
**Why now**: directly answers user's "very interesting bug" question.

### G3. [BENCH][L] LOG-DEBUG-* tasks — debug from logs/traces, not source
**Hypothesis**: Real SRE work is "given these 5 log files + this stack trace + this OTel trace, locate the bug and patch it." Current benchmarks all give source first. This is closer to incident response.
**Measure**: 10 tasks. Each ships with: failing system (multi-service), capture log bundle (timestamps + spans + stack traces), one minimal fix patch. Score = (bug correctly identified) + (patch passes test suite). Token budget enforced.
**Weakest link**: building the log capture pipeline once, reusable across tasks.
**Why now**: 2026 SRE-AI tools (Lightrun, OpenSRE) show this is the next frontier.

### G4. [FORMAL][L] Quint-verified protocol tasks — `QUINT-*` category
**Hypothesis**: Hard tasks become tractable when LLM has a Quint spec it can run/check. Test on distributed protocols (2PC, Raft leader-election, token bucket with refill).
**Measure**: 5 protocols. Method variants: (a) vanilla, (b) given Quint spec + `quint run` traces, (c) given Quint spec + `quint verify` invariants. Test = property-based runner replays ITF traces against generated TS impl. Score = (invariants satisfied across N traces).
**Weakest link**: ITF-trace replay harness for TS impls (Conviva's pattern with Rust + proptest is the template).
**Why now**: Quint maintainers explicitly cite this use case (Zaki Manian quote on quint-lang.org).

### G5. [METHOD][M] `quint-spec-first` method — agent writes Quint spec, then derives TS
**Hypothesis**: Forcing the model to write Quint first (small surface, explicit invariants) catches design bugs before implementation. May *hurt* simple tasks (overhead) but help on G4 + EXTREME tier.
**Measure**: Method scored across all categories. Compare to vanilla, TDD, effect-god-v3.
**Weakest link**: Quint syntax cost — model needs ≥2-shot examples in the prompt.
**Why now**: current "Effect-everywhere" methods underperform; need a formal method that targets *bugs*, not types.

### G6. [BENCH][M] DEBUG-FROM-FAILING-TEST tasks
**Hypothesis**: Different from log-debug: given source + test that fails + an error message, find and fix. Sonnet is good at this in isolation but degrades when the bug is non-local (e.g., shared state, race condition, off-by-one in a distant helper).
**Measure**: 15 tasks with seeded bugs at distances 0/1/2/3 hops from the failing test. Track success rate by hop count.
**Weakest link**: defining "hop distance" (AST-import graph distance? call-graph?).
**Why now**: maps directly to real PR-review / bisect work.

### G7. [BENCH][M] MULTI-TURN-AGENT tasks (real CLI + filesystem)
**Hypothesis**: Single-turn TS tasks ceiling out. Real agentic work requires running build, reading output, editing, iterating. The Agent SDK is already a dep.
**Measure**: 8 tasks where solution requires N ≥ 3 tool-loops (build fails → read error → edit → rebuild). Score = (final tests pass) + bonus for tool-call efficiency.
**Weakest link**: sandboxing — tests must run in isolated tmpdir with declared deps.
**Why now**: aligns benchmark with how Claude Code actually operates.

### G8. [INFRA][S] Replay harness — every run records prompt+response+exit+test-output
**Hypothesis**: Better post-mortem analysis requires structured replays, not just final scores. Helps diagnose *why* effect-god gets stuck at 33%.
**Measure**: every task run emits a `replay.jsonl` of (turn, tool-call, file-diff, test-output). Browsable via a small Web UI.
**Weakest link**: storage size — likely fine with gzip.
**Why now**: we're already paying the cost of running; capturing it is cheap.

### G9. [META][S] Difficulty-calibration: re-score every task with `difficulty` ∈ {S,M,L,XL}
**Hypothesis**: Aggregate scores hide everything. Sonnet at 95% mean is misleading if all the failures cluster on XL. Calibrate by hand.
**Measure**: every task gets a manual difficulty + a "reason for difficulty" tag (type-level, concurrency, math, long-context, etc.). Re-aggregate scores per cell.
**Weakest link**: subjectivity — needs a written rubric.
**Why now**: clarifies what we have, what we lack.

### G10. [METHOD][M] `consensus-of-N` method with cross-method disagreement scoring
**Hypothesis**: Run N=3 different methods (vanilla, effect-god, tdd) and report agreement. Disagreement is a strong signal of latent bugs.
**Measure**: per task, agreement score = (% tests where all N pass). Disagreement triggers a 4th adjudicator agent. Track adjudication accuracy.
**Weakest link**: cost (3× method runs); justifiable only on high-value tasks.
**Why now**: existing `consensus` method exists but isn't measured this way.

### G11. [BENCH][L] REFACTOR-WITHOUT-REGRESSION tasks
**Hypothesis**: LLMs are good at "add feature" but bad at "rewrite this 800-line module preserving behavior + golden test outputs." Multi-file diff with regression risk.
**Measure**: 6 tasks. Each = a working module + a golden test of behavior + a refactor instruction (e.g., "split into 3 modules", "remove this dependency"). Score = (golden tests still pass) + (lines reduced).
**Weakest link**: golden-test design (must be behavior-only, not structural).
**Why now**: huge real-world need; benchmark gap.

### G12. [BENCH][M] LARGE-CONTEXT-NEEDLE tasks (1M-context exploitation)
**Hypothesis**: We're on Opus 4.7 1M context. Most tasks fit in 5KB. Test if models actually use long context, or just attend to the head/tail.
**Measure**: 5 tasks where the bug is buried at a known offset in a 200KB-2MB file. Score by offset bucket.
**Weakest link**: building meaningful "long context" — must be coherent, not padded.
**Why now**: 1M models are here; benchmark hasn't caught up.

### G13. [FORMAL][M] Property-based + Effect Schema fuzz harness for every task
**Hypothesis**: Pair every task with a `fast-check` arbitrary + Schema validation. Score = (PBT shrinks find a counterexample) on seeded-bug variants.
**Measure**: PBT method already exists in repo. Extend to all tasks; report shrink-distance + bug discovery rate.
**Weakest link**: arbitrary design per task — semi-automatable from Schema.
**Why now**: cheap extension; closes a real method gap.

### G14. [META][S] Cost-normalized scoring (composite/$ instead of composite alone)
**Hypothesis**: Some methods win on score but lose 10× on tokens. Surface this.
**Measure**: every method run records prompt+completion tokens. Composite/$ rank-orders methods. Pareto plot.
**Weakest link**: model price drift; freeze prices at a snapshot date.
**Why now**: trivial to add given existing recording infra.

### G15. [BENCH][L] ADVERSARIAL-SPEC tasks — spec contains a contradiction
**Hypothesis**: Real PMs hand over contradictory specs. Good engineers flag it. LLMs typically pick one branch silently. Test: detect-rate.
**Measure**: 10 tasks. Each spec has a buried contradiction (e.g., "sorted ascending" + an example showing descending). Score = (contradiction flagged in output before code).
**Weakest link**: writing contradictions that are *subtle*, not just typos.
**Why now**: very few benchmarks measure this; high signal-to-noise.

---

## Pareto comparison

Dimensions: novelty (does this exist elsewhere?), real-world signal, cost to build, expected discrimination (does it actually separate good from bad models?).

| Goal | Novelty | Signal | Cost | Discrim |
|------|---------|--------|------|---------|
| G1 SEMANTIC-MIRAGE | high | high | M | high |
| G2 mirage skill | med | high | S | med |
| G3 LOG-DEBUG | high | high | L | high |
| G4 Quint protocol | high | high | L | high |
| G5 quint-spec-first method | med | med | M | med |
| G6 DEBUG-FROM-TEST | low | high | M | high |
| G7 MULTI-TURN | med | high | M | high |
| G8 replay harness | low | med | S | low |
| G9 difficulty calibration | low | med | S | med |
| G10 consensus-disagreement | med | med | M | med |
| G11 REFACTOR | high | high | L | high |
| G12 LARGE-CONTEXT-NEEDLE | med | med | M | high |
| G13 PBT+Schema harness | low | med | M | med |
| G14 cost-normalized | low | high | S | med |
| G15 ADVERSARIAL-SPEC | high | high | L | high |

**Pareto front (high signal × reasonable cost)**: G1, G2, G3, G6, G7, G11, G14, G15.
**Highest-leverage single move**: G1+G2 bundle — directly addresses the "looks right but isn't" bug class with both new tasks AND the skill to detect them.
**Highest-novelty trio**: G1, G3, G15.

## Stepping stones (do these even if not picked first)
- G8 replay harness — unlocks deep analysis for everything else
- G9 difficulty calibration — clarifies which goals matter most
- G14 cost-normalized — trivial, makes all comparisons honest

---

## Recommended bundles (pick one)
- **A. Plausibility hunt** (1 week): G1 + G2 + G8. Direct hit on the bug class user named. Lays infra for everything else.
- **B. Quint depth** (3 weeks): G4 + G5 + G13. Goes deep on formal verification with a Quint-first method. Most under-explored axis.
- **C. Realism push** (3 weeks): G3 + G7 + G11. Three new categories closer to actual SWE work.
- **D. Calibration + cost** (3 days): G8 + G9 + G14. Quick wins before bigger investments.

---

**To choose**: comment with the bundle (A/B/C/D) or a custom list (e.g., "G1, G3, G14"). I'll then turn the choice into a structured plan with milestones.
