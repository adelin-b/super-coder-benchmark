# SUPER CODER BENCHMARK — Orchestrator Handoff Document

Purpose: This document is a complete handoff to an orchestrator LLM (Claude Code) that will autonomously design, run, and evaluate experiments comparing verification and reliability methods for AI-generated code.

Operator: Adelin — senior fullstack developer, TypeScript/React/Next.js/Convex stack, runs VroomMarket (car sales platform serving ~20 agencies).

Date: April 1, 2026

---

## PART 1: CONCEPTS ENCYCLOPEDIA

Every method, tool, and idea referenced in this experiment. The orchestrator must understand each one before designing experiments.

---

### 1.1 FORMAL VERIFICATION (Vericoding)

What it is: Instead of testing code against examples, you write a mathematical specification and prove the code satisfies it for ALL possible inputs. A proof checker (not an LLM) verifies the proof — hallucinations are structurally impossible because invalid proofs are rejected deterministically.

Term coined: "Vericoding" — September 2025 ArXiv paper (arxiv.org/abs/2509.22908), contrasted with "vibe coding."

Key insight: Proof checkers perfectly counteract LLM hallucination. The LLM generates the proof; a small, verified checker validates it. If the checker accepts, the code is correct by mathematical certainty.

Current state (April 2026):
- Dafny: 96% LLM success rate (up from 68% one year ago)
- Lean 4: 27% success rate (harder but more expressive)
- Verus/Rust: 44% success rate
- Leanstral (Mistral, March 2026): first open-source formal verification agent, beats Claude Sonnet at 93% lower cost
- Axiom AI: recursive self-improvement loop on verified data
- Harmonic Aristotle: $1.45B valuation, Lean4-based

Tools for this benchmark:
- Dafny — compiles to JavaScript. Closest to TypeScript syntax. 96% LLM success rate. Use dafny verify then dafny build --target:js. Specs use requires (preconditions) and ensures (postconditions).
- Lean 4 — more expressive, harder. Used by AWS (Cedar auth), Microsoft (SymCrypt). 27% success rate but improving fast. Leanstral available for cost-effective proving.
- Coq/Rocq — oldest proof assistant, now officially renamed "Rocq Prover." Most mature library (mathcomp). Critical for this benchmark: coq-of-ts (github.com/formal-land/coq-of-ts) by Formal Land translates TypeScript source code directly into Coq using the TypeScript compiler API. This is the ONLY formal verification path that starts from your actual TypeScript code — no rewrite into a separate language. Formal Land used the same approach (coq-of-ocaml) to verify 100,000 lines of Tezos blockchain code. coq-of-ts is still work-in-progress (handles purely functional subset: functions, records, enums, discriminated unions) but is the most promising path for TypeScript formal verification. Steeper LLM learning curve but unique TypeScript integration.

What it proves: For a function with spec requires X, ensures Y — if the proof compiles, then for EVERY input satisfying X, the output ALWAYS satisfies Y. Not sampled. Not "probably." ALWAYS.

Limitation: Can only verify pure logic. Cannot verify UI rendering, network behavior, or non-deterministic systems directly. Must extract pure business logic into verifiable modules.

---

### 1.2 PROPERTY-BASED TESTING (PBT)

What it is: Instead of writing specific test cases (input=5, expect=10), you define properties that must hold for all inputs ("output is always double the input"). A framework generates hundreds of random inputs and tries to break the property. When it finds a failure, it shrinks to the minimal failing case.

Key research: ArXiv paper (2506.18315) showed 23–37% pass@1 improvement over TDD when validating AI-generated code. PBT breaks the "cycle of self-deception" where AI-generated tests share conceptual flaws with AI-generated code.

Tools for this benchmark:
- fast-check (TypeScript/JS) — the standard PBT library for the JS ecosystem
- Hypothesis (Python) — gold standard PBT, used in the largest evaluation (100 Python packages, found real bugs in NumPy)

What it proves: Properties hold for all tested inputs (hundreds/thousands of random cases). NOT mathematical proof — but much stronger than example-based tests. The shrinking to minimal failing input is particularly valuable for LLM feedback loops.

Advantage over formal verification: Works with any language, any framework, any side effect. Can test React components, API handlers, database queries. No new language required.

---

### 1.3 EFFECT TS + XSTATE (Type-Safe Ratchet)

What it is: A TypeScript-native approach to reliability using two libraries:

Effect TS: Replaces try/catch with typed error channels. Every function signature declares Effect<Success, Error, Requirements> — the TypeScript compiler enforces that all errors are handled. If the AI forgets to handle an error, it's a compile-time failure, not a runtime crash.

XState v5: Models application lifecycle as a state machine (statechart). Every UI flow, backend process, or agent workflow becomes a finite state machine with explicitly defined transitions. Invalid state transitions are impossible by construction.

The "Super Coder" claim: By forcing the LLM to write Effect TS + XState, you get a "Type-Safe Ratchet" — TypeScript's compiler catches errors the LLM introduces. The pasted prompt claims this lets TypeScript compete with Elixir's 99% reliability tier.

What it proves: Type safety (no unhandled errors, no invalid states). Does NOT prove logical correctness — a function can handle all error types but still compute the wrong answer.

---

### 1.4 MULTI-MODEL CONSENSUS (Ensemble Voting)

What it is: Generate the same code from 3-5 different LLMs, then compare outputs. Correct solutions cluster; hallucinations don't. Research showed 90.2% accuracy on HumanEval vs 83.5% for the best single model.

Patterns:
- Simple majority: 3 models vote, take the majority answer
- LLM Council (Karpathy): poll models as anonymous experts, peer review with hidden identity
- EnsLLM: CodeBLEU + CrossHair differential behavior analysis for structured voting
- Crucible (Elixir-inspired): multiple models confirm a code change before commit

What it proves: Statistical agreement across independent generators. Not mathematical proof, but error rates compound favorably.

Cost: 3-5× inference cost. Economically rational for critical paths where a bug costs more than the extra API calls.

---

### 1.5 OUTCOME REWARD MODELS (ORMs)

What it is: A smaller, faster model trained to predict "will this code pass tests?" without running the tests. Used to prune obviously wrong candidates before expensive verification.

Pattern: Generate N candidates → ORM scores them → run full tests only on top K → pick best. Research showed 11.65× faster verification at 91.67% accuracy.

---

### 1.6 MCTS OVER REASONING (RethinkMCTS)

What it is: Monte Carlo Tree Search applied to the reasoning process before code generation. Explores reasoning paths (not code paths), uses execution feedback to correct flawed reasoning during search.

Key insight: Searching the thought space before code generation dramatically outperforms searching code directly.

---

### 1.7 THE AUTORESEARCH LOOP (Karpathy)

What it is: An autonomous experiment loop. Three components:
1. Editable asset — the single file the agent can modify
2. Scalar metric — the single number that determines improvement
3. Time-boxed cycle — fixed duration makes every experiment comparable

THIS IS THE EXPERIMENT FRAMEWORK for this benchmark.

---

### 1.8–1.11

Context Engineering, Parallel Agent Orchestration, Self-Improving Agent Loops, Spec-First Pipeline — see full handoff document for details.

---

## PART 2–5: See HANDOFF-FULL.md for complete experiment design, scoring system, method prompts, incremental execution plan, and SWE-bench integration.
