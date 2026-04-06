# Deep Research: Benchmarks for "Build from Complex Spec + Tests"

**Date:** 2026-04-06
**Scope:** Exhaustive survey of benchmarks where the task is: given business requirements and/or a test suite, build the implementation from scratch.

---

## 1. Executive Summary

### What exists

The LLM code benchmark ecosystem is **vast but narrowly focused**. As of April 2026, there are 50+ coding benchmarks, but they cluster into a few categories:

1. **Function-level algorithmic puzzles** (HumanEval, MBPP, APPS, LiveCodeBench) -- simple, self-contained, 5-30 lines, algorithmic in nature.
2. **Bug-fixing in existing codebases** (SWE-bench, SWE-bench Pro, SWE-Lancer) -- given a repo + issue, generate a patch. Not "build from scratch."
3. **Class-level generation** (ClassEval, JavaBench, OOP, MultiOOP) -- build a class from a docstring/skeleton. Closer to our goal but still synthetic, small-scope, and without complex business logic.
4. **Repository-level completion** (RepoBench, CoderEval, DevEval, EvoCodeBench) -- generate code in context of an existing repo. Primarily function/method-level completion with cross-file context.
5. **Domain-specific generation** (BigCodeBench, NaturalCodeBench, DomainCodeBench, DSCodeBench) -- tasks that use real libraries/APIs. More complex than HumanEval but still single-function.
6. **Web app generation** (WebApp1K/TDD-Bench, Vibe Code Bench, WebGen-Bench) -- build a web component/app from a spec. Closest in spirit but focused on UI, not business logic.
7. **Formal verification** (VERINA, CLEVER, DafnyComp) -- generate verified code from formal specs. Focus is on proofs, not business rules.

### What does NOT exist

**No benchmark combines all of these properties:**
- Complex, interacting business rules (not algorithms)
- 30+ tests per task encoding domain constraints
- "Build from scratch" with implementation freedom
- Multi-function/module scope (100+ LOC)
- TypeScript/JavaScript
- Focus on correctness of business logic (rate limiting, billing, inventory, etc.)

This is precisely the gap our benchmark fills.

---

## 2. Comprehensive Benchmark Table

| # | Benchmark | Year | Task Format | Complexity | Build vs Fix | Language(s) | Tests/Task | LOC/Task | Suitability |
|---|-----------|------|-------------|------------|-------------|-------------|------------|----------|-------------|
| 1 | **HumanEval** | 2021 | Docstring -> function | Low | Build | Python | ~8 | 5-15 | Low -- too simple |
| 2 | **MBPP** | 2021 | NL description -> function | Low | Build | Python | 3 | 5-10 | Low -- too simple |
| 3 | **APPS** | 2021 | Problem statement -> solution | Low-High | Build | Python | ~21 | 10-200 | Medium -- algorithmic, not business |
| 4 | **ClassEval** | 2023 | Class skeleton + docstring -> class | Medium | Build | Python | 33.1 avg | ~46 | **High** -- class-level, good test coverage |
| 5 | **CoderEval** | 2023 | Context + docstring -> function | Medium | Build | Python, Java | Varies | Varies | Medium -- pragmatic but function-level |
| 6 | **BigCodeBench** | 2024 | Docstring/instruction -> function | Medium | Build | Python | 5.6 avg | ~30 | Medium -- complex instructions, single-function |
| 7 | **NaturalCodeBench** | 2024 | Real user query -> solution | Medium | Build | Python, Java | Varies | Varies | Medium -- real queries, 6 domains |
| 8 | **DevEval** | 2024 | Requirements + repo context -> code | Medium-High | Build | Python+ | Varies | Varies | Medium -- real repos, 10 domains |
| 9 | **EvoCodeBench** | 2024 | Repo context -> function | Medium | Build | Python | Varies | Varies | Low -- function completion |
| 10 | **DomainCodeBench** | 2024 | Docstring -> function (12 domains) | Medium | Build | 15 languages | Varies | Varies | Medium -- multi-domain but function-level |
| 11 | **ComplexCodeEval** | 2024 | Signature + docstring -> function | Medium | Build | Python, Java | Varies | Varies | Medium -- API-heavy, multi-task |
| 12 | **JavaBench** | 2024 | Project spec -> OOP classes | High | Build | Java | Varies | 389 methods/106 classes | **High** -- project-level OOP |
| 13 | **OOP/MultiOOP** | 2024 | Problem -> class implementation | Medium | Build | 6 languages | Varies | Varies | Medium -- OOP-focused |
| 14 | **SWE-bench** | 2023 | Issue + repo -> patch | Medium-High | **Fix** | Python | Varies | Varies | Low -- bug fixing, not build |
| 15 | **SWE-bench Pro** | 2025 | Issue + repo -> multi-file patch | High | **Fix** | 123 languages | Varies | Varies | Low -- long-horizon fixing |
| 16 | **SWE-Lancer** | 2025 | Freelancer task + repo -> patch | High | **Fix** (88%) | TypeScript+ | Varies | Varies | Low -- mostly bug fixes |
| 17 | **LiveCodeBench** | 2024 | Contest problem -> solution | Medium | Build | Python | Varies | Varies | Low -- competitive programming |
| 18 | **RepoBench** | 2023 | Repo context -> next line/block | Low | Complete | Python, Java | N/A | ~6 | Low -- completion only |
| 19 | **DevBench** | 2024 | Context -> completion (6 langs) | Medium | Complete | 6 languages | Varies | ~6.3 | Low -- completion only |
| 20 | **WebApp1K** | 2025 | Jest tests -> React component | Medium | **Build** | JavaScript | 2-4 | 35-46 | **High** -- TDD, build from tests! |
| 21 | **Vibe Code Bench** | 2025 | Text spec -> full web app | Very High | **Build** | Multi | Varies | 500+ | **High** -- build from spec, but UI-focused |
| 22 | **WebGen-Bench** | 2025 | NL instruction -> website | High | **Build** | HTML/CSS/JS | Varies | Varies | Medium -- UI-focused, not business logic |
| 23 | **Terminal-Bench** | 2025 | Real-world task -> solution | High | Build/Fix | Various | Varies | Varies | Medium -- system tasks, not business logic |
| 24 | **ResearchCodeBench** | 2025 | ML paper -> implementation | Very High | **Build** | Python | Varies | Varies | Medium -- ML-specific, not business |
| 25 | **VERINA** | 2025 | Problem -> verified Lean code | High | Build | Lean 4 | 100% coverage | Varies | Medium -- formal verification focus |
| 26 | **CLEVER** | 2025 | NL -> spec + proof + code | Very High | Build | Lean 4 | N/A | Varies | Low -- proof-focused |
| 27 | **DafnyComp** | 2025 | Spec -> compositional Dafny | High | Build | Dafny | N/A | Varies | Low -- verification-focused |
| 28 | **BDDCoder** | 2025 | BDD scenarios -> code | Medium | Build | Python | Varies | Varies | Medium -- BDD framework, not a benchmark dataset |
| 29 | **DSCodeBench** | 2025 | Data science task -> code | Medium | Build | Python | Strong suites | Varies | Low -- data science specific |
| 30 | **ts-bench** | 2025 | Exercism spec + tests -> TS code | Medium | **Build** | TypeScript | Varies | Varies | **High** -- TypeScript, tests given |
| 31 | **Aider Polyglot** | 2024 | Exercism problems -> solutions | Medium | Build | 6 languages | Varies | Varies | Medium -- includes JS, but algorithmic |
| 32 | **BREX** | 2025 | Business docs -> rule extraction | Medium | Extract | N/A (rules) | N/A | N/A | Low -- rule extraction, not code generation |
| 33 | **Large-scale ClassEval** | 2025 | Real project -> class impl | High | Build | Python | Varies | Varies | Medium -- 842K classes, real projects |
| 34 | **GitHub Spec Kit** | 2025 | Spec -> implementation | Varies | **Build** | Any | Varies | Varies | Medium -- framework, not benchmark |

---

## 3. Top 5 Most Suitable for Our Use Case

### Rank 1: WebApp1K (TDD-Bench)
- **Why:** This is the closest existing benchmark to what we want. Tests are given as the prompt (TDD-style), the model must build from scratch, and tasks cover 20 application domains including e-commerce, personal finance, task management, etc.
- **Gap:** Tasks are small (35-46 LOC, only 2-4 tests each). Focused on React UI components, not deep business logic. No interacting rules, no edge cases.
- **Paper:** [Tests as Prompt (arxiv 2505.09027)](https://arxiv.org/abs/2505.09027)
- **Access:** [HuggingFace Leaderboard](https://huggingface.co/spaces/onekq-ai/WebApp1K-models-leaderboard)

### Rank 2: ClassEval
- **Why:** 100 classes, average 33.1 test cases per class, ~4 methods per class. Tests given as evaluation, model builds from skeleton + docstring. Closest to our "spec + tests -> implementation" format.
- **Gap:** Tasks are synthetic, Python only, and cover generic CS topics (math operations, data formatting) rather than complex business domains. Test suites are for validation, not given as input.
- **Paper:** [ClassEval (arxiv 2308.01861)](https://arxiv.org/abs/2308.01861)
- **Access:** [GitHub](https://github.com/FudanSELab/ClassEval)

### Rank 3: Vibe Code Bench
- **Why:** 100 realistic app specs, model builds entire web apps from scratch with no constraints on implementation approach. Multi-hour tasks, high complexity.
- **Gap:** Focus is on full-stack web apps (UI + backend), not isolated business logic modules. Evaluation is holistic (does the app work?), not test-suite-driven.
- **Paper:** [Vibe Code Bench (arxiv 2603.04601)](https://arxiv.org/abs/2603.04601)
- **Access:** [vals.ai](https://www.vals.ai/benchmarks/vibe-code)

### Rank 4: ts-bench (Exercism TypeScript)
- **Why:** TypeScript! Tests are given, model builds from spec. Exercism problems include a spec document, a code template, and a test suite.
- **Gap:** Exercism problems are algorithmic/educational, not business-domain. Tasks are small (single-module). Low complexity ceiling.
- **Paper:** [Medium article by laiso](https://medium.com/@laiso/introducing-ts-bench-a-reproducible-benchmark-for-evaluating-ai-coding-agents-typescript-19bcf960cb7c)
- **Access:** [GitHub](https://github.com/laiso/ts-bench)

### Rank 5: JavaBench
- **Why:** Project-level OOP, 4 Java projects, 389 methods across 106 classes. Tests OOP design patterns, encapsulation, inheritance, polymorphism. Closest to "complex interacting code."
- **Gap:** Java only. Only 4 projects (very small dataset). Academic OOP exercises, not business domains. No LLM scored 100% on any project.
- **Paper:** [JavaBench (arxiv 2406.12902)](https://arxiv.org/abs/2406.12902)
- **Access:** Linked from paper

---

## 4. Gap Analysis: What Is Missing in the Ecosystem

### Gap 1: No "Business Logic Construction" Benchmark
Every benchmark either tests algorithmic puzzles, UI generation, or bug-fixing. **None** test the core enterprise software engineering task: implementing complex, interacting business rules from a specification.

Examples of untested scenarios:
- Token bucket rate limiting with per-tenant configuration
- Multi-tier billing with discounts, caps, proration
- Inventory management with reservations, backorders, reconciliation
- Insurance claim adjudication with cascading rules
- Financial transaction processing with compliance checks

### Gap 2: Test Suite as Primary Specification
Only WebApp1K uses tests as the prompt. All other benchmarks use natural language descriptions or docstrings. In real-world TDD, **tests ARE the spec**. No benchmark evaluates the ability to read a comprehensive test suite (30+ tests) and infer the requirements.

### Gap 3: Multi-Function Interaction Complexity
Most benchmarks test isolated functions. Even ClassEval's classes have independent methods. **No benchmark** tests whether an LLM can implement multiple functions that must interact correctly (e.g., `consume()` must respect `refill()` timing, `getBalance()` must reflect `deposit()` and `withdraw()` history).

### Gap 4: Edge Case Density
Existing benchmarks have 2-8 tests per task (except ClassEval at ~33). Business logic requires testing edge cases like:
- Boundary conditions (exactly at threshold)
- Invalid inputs (negative amounts, empty strings)
- State-dependent behavior (order of operations matters)
- Concurrency/timing effects
- Cascading constraint violations

### Gap 5: Seeded Bug Detection
No benchmark evaluates whether a test suite can **distinguish correct implementations from plausible-but-wrong ones**. Our benchmark uniquely tests this with seeded bugs (e.g., shared bucket bug, refill overflow, no validation).

### Gap 6: TypeScript/JavaScript Business Logic
Python dominates (~80% of benchmarks). TypeScript has only ts-bench (Exercism) and WebApp1K (React). **No benchmark** tests TypeScript business logic implementation at the module level.

### Gap 7: Implementation Freedom
Most benchmarks constrain the implementation (fill in a function, match a skeleton). Few allow the model to make architectural choices (data structures, helper functions, module organization) while still being verified against a rigorous test suite.

### Gap 8: Methodology Comparison
No benchmark is designed to compare *how* code is generated (plain generation vs. TDD vs. formal verification vs. property-based testing). Our benchmark's multi-method design is unique.

---

## 5. Recommendation: Build Our Own "Business Logic Construction Benchmark"

Based on this research, we should formalize and publish the benchmark we have already built. Here are concrete design principles derived from the ecosystem gaps:

### Design Principles

**P1: Tests as Specification**
The test suite IS the spec. Models receive only: (a) a natural-language task description, (b) a comprehensive test file (30-100+ tests), and (c) type signatures/interfaces. They must build the implementation from scratch. This is validated by WebApp1K's approach but at much higher complexity.

**P2: Business Domain Tasks**
Every task encodes real business rules, not algorithms. Our existing tasks (rate limiting, billing, inventory, graph algorithms applied to business contexts) are the right template. Expand to cover:
- Financial: multi-currency ledger, loan amortization, tax calculation with jurisdiction cascading
- SaaS: subscription lifecycle, usage metering, feature flags with targeting rules
- Insurance: claim adjudication, policy underwriting rules, premium calculation
- Healthcare: appointment scheduling with provider rules, medication interaction checks
- E-commerce: cart pricing (coupons, bundles, volume discounts), inventory reservation

**P3: Multi-Function Interaction**
Each task requires 3-8 interacting functions/methods where correctness depends on how they work together. State is shared. Order of operations matters. This is the key differentiator from ClassEval.

**P4: Seeded Bug Variants**
For each task, provide 3-4 plausible-but-incorrect implementations (bugs). A good test suite must catch these. This creates a dual evaluation:
- Can the LLM build correct code? (generation quality)
- Can the LLM's testing methodology catch subtle bugs? (test quality)

**P5: TypeScript-First, Multi-Language Later**
Start with TypeScript (our strength, underserved in benchmarks). The type system adds a dimension: models must satisfy both types and tests. Expand to Python, Go, Rust later.

**P6: Difficulty Tiers**
- Tier 1 (30-50 tests, 50-100 LOC): Single-concern business rules (rate limiter, discount calculator)
- Tier 2 (50-80 tests, 100-200 LOC): Multi-concern with interactions (billing system, inventory manager)
- Tier 3 (80-120+ tests, 200-400 LOC): Full domain modules (subscription lifecycle, claim adjudication engine)

**P7: Evaluation Metrics**
- **Pass@1**: Does the implementation pass all tests on first attempt?
- **Bug Detection Rate**: Do the model's tests catch seeded bugs?
- **Methodology Score**: How does generation method affect quality? (TDD vs PBT vs formal vs plain)
- **Implementation Quality**: Beyond correctness -- code clarity, type safety, idiomatic patterns

**P8: Open and Reproducible**
Publish on HuggingFace and GitHub with:
- Task descriptions and test suites
- Reference implementations
- Seeded bug variants with labels
- Automated evaluation harness (vitest-based)
- Leaderboard

### What We Already Have

Our current benchmark (`super-coder-benchmark`) already implements most of these principles across 11 tasks (SAAS-2, SAAS-3, BL-1 through BL-5, ALG-1 through ALG-3) with:
- 10 methodology variants (plain TS, Effect/XState, TDD, PBT, Dafny, Lean4, Coq, consensus, PBT+Effect, Dafny+PBT)
- 3-4 seeded bugs per task
- 30-80+ tests per task
- Full evaluation matrix (1120 tests)

### Proposed Name

**BizLogicBench** -- Business Logic Construction Benchmark

### Publication Path
1. Formalize task format and documentation
2. Expand to 25-30 tasks across 6+ business domains
3. Run evaluation on frontier models (GPT-5.3, Claude Opus 4, Gemini 3.1 Pro, DeepSeek R1, Qwen 3)
4. Write paper positioning against ClassEval, WebApp1K, SWE-bench
5. Submit to NeurIPS 2026 Datasets & Benchmarks track (or ICLR 2027)

---

## 6. Related Work and Frameworks (Not Benchmarks)

| Framework | Description | Relevance |
|-----------|-------------|-----------|
| **GitHub Spec Kit** | Toolkit for spec-driven development with AI agents | Framework for SDD workflow, not a benchmark. Could be used as harness. |
| **CURRANTE** | VSCode extension for human-in-the-loop TDD with LLMs | Research tool, not benchmark. Studies spec->test->code workflow. |
| **BDDCoder** | Multi-agent BDD framework (Programmer, Tester, Analyst, User) | Methodology framework. Evaluated on HumanEval/MBPP, not business tasks. |
| **Aider** | CLI tool with polyglot benchmark using Exercism | Evaluation tool + benchmark. 225 tasks, 6 languages, algorithmic focus. |
| **BREX** | 409 business documents, 2855 expert-annotated rules | Rule extraction benchmark, not code generation. Shows business rule complexity. |

---

## 7. Key Academic References

1. **Tests as Prompt** (Chen et al., 2025) -- WebApp1K TDD benchmark. [arxiv:2505.09027](https://arxiv.org/abs/2505.09027)
2. **ClassEval** (Du et al., 2023) -- Class-level code generation. [arxiv:2308.01861](https://arxiv.org/abs/2308.01861)
3. **BigCodeBench** (Zhuo et al., 2024) -- Complex function-level tasks. [arxiv:2406.15877](https://arxiv.org/abs/2406.15877)
4. **Specification-Driven Code Generation** (SANER 2026) -- Empirical study design. [arxiv:2601.03878](https://arxiv.org/abs/2601.03878)
5. **Business as Rulesual** (2025) -- Business rule flow modeling. [arxiv:2505.18542](https://arxiv.org/abs/2505.18542)
6. **Vibe Code Bench** (2025) -- End-to-end web app generation. [arxiv:2603.04601](https://arxiv.org/abs/2603.04601)
7. **JavaBench** (2024) -- Project-level OOP generation. [arxiv:2406.12902](https://arxiv.org/abs/2406.12902)
8. **SWE-Lancer** (OpenAI, 2025) -- Freelance engineering tasks. [arxiv:2502.12115](https://arxiv.org/abs/2502.12115)
9. **NaturalCodeBench** (2024) -- Real user queries across 6 domains. [arxiv:2405.04520](https://arxiv.org/abs/2405.04520)
10. **DomainCodeBench** (2024) -- Multi-domain, 15 languages. [arxiv:2412.18573](https://arxiv.org/abs/2412.18573)
11. **ResearchCodeBench** (2025) -- ML paper implementation. [arxiv:2506.02314](https://arxiv.org/abs/2506.02314)
12. **VERINA** (2025) -- Verifiable code generation in Lean. [arxiv:2505.23135](https://arxiv.org/abs/2505.23135)
13. **ComplexCodeEval** (2024) -- Multi-task complex code evaluation. [arxiv:2409.10280](https://arxiv.org/abs/2409.10280)
14. **DevEval** (2024) -- Real-world repo-aligned generation. [arxiv:2405.19856](https://arxiv.org/abs/2405.19856)
15. **SWE-bench Pro** (Scale AI, 2025) -- Long-horizon SE tasks. [arxiv:2509.16941](https://arxiv.org/abs/2509.16941)
16. **Beyond Synthetic Benchmarks** (2025) -- Real-world class-level generation. [arxiv:2510.26130](https://arxiv.org/abs/2510.26130)
17. **TDD-Bench Verified** (2024) -- Test generation for issues. [arxiv:2412.02883](https://arxiv.org/abs/2412.02883)
18. **BDDCoder** (2025) -- BDD for code generation. [Springer](https://link.springer.com/chapter/10.1007/978-981-95-0014-7_4)
19. **WebGen-Bench** (2025) -- Website generation from scratch. [arxiv:2505.03733](https://arxiv.org/abs/2505.03733)
20. **Large-scale ClassEval** (2025) -- 842K real-world classes. [arxiv:2504.15564](https://arxiv.org/abs/2504.15564)

---

## 8. Conclusion

The ecosystem has a clear, publishable gap. No existing benchmark evaluates the ability to:

> **Given complex, interacting business rules expressed as a comprehensive test suite (30-100+ tests), build a correct implementation from scratch with full architectural freedom.**

The closest benchmarks (WebApp1K, ClassEval) either lack complexity, lack business domains, or lack the test-as-spec paradigm. Our `super-coder-benchmark` is uniquely positioned to fill this gap as **BizLogicBench**, the first Business Logic Construction Benchmark for LLM evaluation.
