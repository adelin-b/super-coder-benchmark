# Bleeding-Edge Coding Benchmarks Where Top Models Score Below 20%

> Research compiled: April 12, 2026
> Focus: Benchmarks published in the last 6 months (Oct 2025 - Apr 2026) where frontier models (Claude Opus 4.6, GPT-5.4, Gemini 3.1 Pro) score poorly

---

## Executive Summary

The coding benchmark landscape has undergone a seismic shift. HumanEval (99.4% SOTA) and MBPP (94.2% SOTA) are completely saturated. Even SWE-Bench Verified is contaminated -- OpenAI confirmed every frontier model shows training data leakage and stopped reporting scores. The industry has moved toward harder, multi-dimensional evaluations where even the best models struggle badly.

**Benchmarks where top models score BELOW 20%:**

| Benchmark | Best Model Score | Year | Available? |
|-----------|-----------------|------|------------|
| FeatureBench | 12.5% (GPT-5.1-Codex) | 2025-2026 (ICLR 2026) | Yes |
| ARC-AGI-3 | 0.37% (Gemini 3.1 Pro) | 2026 | Yes |
| Web-Bench | 25.1% SOTA, avg open-source 10.7% | 2025 | Yes |
| Frontier-CS (Research Track) | Far below human 86.99 | 2025-2026 | Yes |
| USACO Platinum | ~8.7% zero-shot (GPT-4) | 2024-2026 | Yes |
| Terminal-Bench Hard | 16% avg on hard tasks | 2025-2026 | Yes |
| VeriBench (raw LLM, no agent) | 12.5% (Claude 3.7 Sonnet) | 2025 | Yes |
| SWE-CI (zero-regression) | <25% for most models | 2026 | Yes |
| FeatureBench Full Set | 11.0% (Claude Opus 4.5) | 2026 | Yes |

---

## TIER 1: THE ABSOLUTE HARDEST (Below 5% for top models)

### 1. ARC-AGI-3 -- Interactive Agentic Intelligence

- **Published:** March 25, 2026
- **What it tests:** Hundreds of interactive turn-based environments with game-style levels. No instructions, no rules, no stated goals. Agents must explore, discover objectives, learn, and adapt.
- **Scores:**
  - Gemini 3.1 Pro Preview: **0.37%**
  - GPT-5.4: **0.26%**
  - Claude Opus 4.6: **0.25%**
  - Grok-4.20: **0.00%**
  - Humans: **100%**
  - Symbolica Agentica SDK (specialized): **36%** ($1,005 for 113/182 levels)
- **Dataset available:** Yes, via API and local play
- **TypeScript compatible:** No (Python API, environment-based)
- **Prize:** $2,000,000+
- **URLs:**
  - Paper: https://arxiv.org/html/2603.24621v1
  - Competition: https://arcprize.org/competitions/2026/arc-agi-3
  - Leaderboard: https://arcprize.org/leaderboard

### 2. USACO Platinum -- Competitive Programming Olympiad

- **Published:** Ongoing (2024-2026 seasons)
- **What it tests:** USA Computing Olympiad Platinum division problems -- 307 problems with exhaustive test cases, requiring advanced algorithmic reasoning (DP, graphs, geometry, number theory).
- **Scores:**
  - GPT-4 zero-shot CoT: **8.7% pass@1**
  - Best inference method (self-reflection + episodic retrieval): **20.2%**
  - Base models on Gold and above: **near-zero**
  - Targeted hints enable solving 13/15 previously unsolvable problems
- **Dataset available:** Yes
- **TypeScript compatible:** No (C++ dominant in competitive programming)
- **URLs:**
  - Benchmark: https://princeton-nlp.github.io/USACOBench/
  - HAL Leaderboard: https://hal.cs.princeton.edu/usaco
  - 2026 Season Results: https://usaco.org/index.php?page=season26contest3results

---

## TIER 2: EXTREMELY HARD (Below 15% for top models)

### 3. FeatureBench -- Complex Feature Development (ICLR 2026)

- **Published:** February 2026 (ICLR 2026)
- **What it tests:** Feature-level coding tasks spanning multiple commits and PRs. 200 evaluation tasks, 3,825 executable environments from 24 open-source repos. Requires writing substantial code and passing comprehensive test suites.
- **Scores:**
  - Claude Code + Claude Opus 4.5: **11.0%** (Full set)
  - Codex + GPT-5.1-Codex (medium reasoning): **12.5%** (Full set)
  - For context: Claude Opus 4.5 scores 74.4% on SWE-bench -- but only 11% here
- **Dataset available:** Yes (GitHub + HuggingFace)
- **TypeScript compatible:** Primarily Python repos, but benchmark framework is extensible
- **URLs:**
  - GitHub: https://github.com/LiberCoders/FeatureBench
  - Paper: https://arxiv.org/abs/2602.10975
  - OpenReview: https://openreview.net/forum?id=41xrZ3uGuI

### 4. VeriBench -- End-to-End Formal Verification in Lean 4

- **Published:** 2025 (ICML presentation)
- **What it tests:** Complete Lean 4 programs -- implementations, unit tests, correctness theorems, and formal proofs. 113 tasks (51 HumanEval, 42 exercises, 10 algorithms, 11 security).
- **Scores (raw LLM, no agent loop):**
  - Claude 3.7 Sonnet: **12.5% compilation rate**
  - LLaMA-70B: **0%** (even with 50 feedback attempts)
  - Self-optimizing Trace agent: approaches 60-90%
- **Dataset available:** Yes
- **TypeScript compatible:** No (Lean 4 specific)
- **URLs:**
  - OpenReview: https://openreview.net/forum?id=rWkGFmnSNl

### 5. Web-Bench -- Real Web Development (ByteDance)

- **Published:** May 2025
- **What it tests:** 50 projects, each with 20 sequentially dependent tasks. Covers Web Standards (DOM, CSS, JS) and Web Frameworks (React, Vue, etc.). Each project takes a senior engineer 4-8 hours.
- **Scores:**
  - SOTA (Claude 3.7 Sonnet Thinking): **25.1% Pass@1**
  - Average closed-source models: **15.08% Pass@1**
  - Average open-source models: **10.73% Pass@1**
  - Average closed-source Pass@2: 20.79%, open-source Pass@2: 14.84%
- **Dataset available:** Yes (GitHub + HuggingFace)
- **TypeScript compatible:** YES -- this is a web development benchmark, TypeScript is a core standard
- **URLs:**
  - GitHub: https://github.com/bytedance/web-bench
  - HuggingFace Dataset: https://huggingface.co/datasets/bytedance-research/Web-Bench
  - Leaderboard: https://huggingface.co/spaces/bytedance-research/Web-Bench-Leaderboard
  - Paper: https://arxiv.org/html/2505.07473v1

---

## TIER 3: VERY HARD (Below 30% for top models)

### 6. SWE-Bench Pro (SEAL) -- Multi-Language Software Engineering

- **Published:** 2025-2026 (ongoing)
- **What it tests:** 1,865 tasks across 41 repos in Python, Go, TypeScript, JavaScript. Multi-file, multi-language engineering. Average 107 lines across 4.1 files per task.
- **Scores (SEAL standardized scaffolding):**
  - Claude Opus 4.5: **45.9%** (highest on SEAL)
  - GPT-5 (High): **41.8%**
  - GPT-5.2 Codex: **41.0%**
  - Gemini 3.1 Pro: **43.3%**
  - Qwen 3.5: **38.7%**
  - DeepSeek V3.2: **33%**
  - OpenAI GPT-4o: **4.9%**
  - Qwen-3 32B: **3.4%**
  - **With SWE-Agent (no custom scaffold): GPT-5 = 23.3%, Claude Opus 4.1 = 23.1%**
- **Dataset available:** Yes (public dataset)
- **TypeScript compatible:** YES -- includes TypeScript and JavaScript tasks
- **URLs:**
  - Leaderboard: https://labs.scale.com/leaderboard/swe_bench_pro_public
  - Analysis: https://www.morphllm.com/swe-bench-pro

### 7. SWE-EVO -- Long-Horizon Software Evolution

- **Published:** December 2025 (arXiv)
- **What it tests:** 48 tasks from release notes of 7 mature Python projects, requiring multi-step modifications spanning average 21 files, validated against test suites averaging 874 tests per instance.
- **Scores:**
  - GPT-5.4 with OpenHands: **25%**
  - Compare: GPT-5.2 on SWE-Bench Verified: 72.80%
- **Dataset available:** Yes
- **TypeScript compatible:** No (Python repos)
- **URLs:**
  - Paper: https://arxiv.org/abs/2512.18470

### 8. SWE-CI -- Continuous Integration & Long-Term Maintenance

- **Published:** March 2026 (Alibaba)
- **What it tests:** Can agents maintain codebases through months of real evolution? 100 tasks, each spanning average 233 days and 71 consecutive commits. Tests if agents break previously working code.
- **Scores:**
  - **75% of tested models break previously working code**
  - Only Claude Opus stays above 50% zero-regression
  - Every other model falls below 25% zero-regression
  - 18 AI models tested on 100 real codebases
- **Key metric:** EvoScore (penalizes short-term optimization)
- **Dataset available:** Yes
- **TypeScript compatible:** No (Python repos)
- **URLs:**
  - Paper: https://arxiv.org/html/2603.03823v1

### 9. Frontier-CS -- Unsolved Computer Science Problems

- **Published:** December 2025 (UC Berkeley Sky Computing Lab)
- **What it tests:** 240 unsolved CS problems authored by CS PhDs and ICPC World Final-level experts. Covers systems, ML, algorithms, security. No known optimal solutions. Deterministic scoring (not pass/fail).
- **Scores:**
  - Human reference: **86.99 (Score@1)**
  - Frontier reasoning models: **far below human experts** on both algorithmic and research tracks
- **Dataset available:** Yes (GitHub, rolling releases)
- **TypeScript compatible:** Algorithmic track supports C++; research track is multi-language
- **URLs:**
  - GitHub: https://github.com/FrontierCS/Frontier-CS
  - Paper: https://arxiv.org/html/2512.15699v1
  - Website: https://frontier-cs.org/

### 10. Terminal-Bench Hard -- Command-Line Engineering

- **Published:** 2025-2026 (Vals.ai + Snorkel)
- **What it tests:** 89 tasks across model training, system administration, DevOps, and more in sandboxed terminal environments.
- **Scores (Hard subset):**
  - GPT-5.4 (xhigh): **57.6%**
  - Gemini 3.1 Pro Preview: **53.8%**
  - GPT-5.3 Codex (xhigh): **53.0%**
  - Average accuracy on hard tasks: **~16%**
  - Performance drops from 65% (easy) to 16% (hard)
- **Dataset available:** Yes (open-source)
- **TypeScript compatible:** No (terminal/CLI tasks)
- **URLs:**
  - Terminal-Bench 2.0: https://www.vals.ai/benchmarks/terminal-bench-2
  - Hard Leaderboard: https://artificialanalysis.ai/evaluations/terminalbench-hard
  - GitHub: https://github.com/laude-institute/terminal-bench
  - Leaderboard: https://www.tbench.ai/leaderboard

---

## TIER 4: HARD WITH IMPORTANT SIGNAL (Below 50% for top models)

### 11. FLTEval -- Formal Proof Engineering (Fermat's Last Theorem)

- **Published:** March 2026 (Mistral)
- **What it tests:** Completing formal proofs and defining new mathematical concepts in PRs to the Fermat's Last Theorem formalization project in Lean 4.
- **Scores:**
  - Claude Opus 4.6: **39.6** (highest)
  - Leanstral (6B active params): **26.3** (pass@2), 31.9 (pass@16)
  - Claude Sonnet: **23.7**
  - Qwen3.5-397B: **25.4** (pass@4)
  - GLM5-744B: caps at ~16.6
- **Dataset available:** Yes (via Mistral)
- **TypeScript compatible:** No (Lean 4)
- **URLs:**
  - Mistral announcement: https://mistral.ai/news/leanstral

### 12. IndustryCode -- Industrial Domain Code Generation

- **Published:** April 2026 (arXiv)
- **What it tests:** 579 sub-problems from 125 industrial challenges across finance, automation, aerospace, remote sensing. Languages: MATLAB, Python, C++, Stata.
- **Scores (main problems, not sub-problems):**
  - Claude 4.5 Opus: **42.5%** (best)
  - Sub-problem range: 27.7% to 68.1%
- **Dataset available:** Yes
- **TypeScript compatible:** No (MATLAB, Python, C++, Stata)
- **URLs:**
  - Paper: https://arxiv.org/abs/2604.02729

### 13. ProjDevBench -- End-to-End Project Development

- **Published:** February 2026 (arXiv)
- **What it tests:** 20 programming problems across 8 categories. Complete executable software repos from high-level specs. Tests architecture design, functional correctness, iterative refinement.
- **Scores:**
  - Codex + GPT-5: **77.85%** (best overall)
  - Overall acceptance rate: **27.38%**
  - Agents handle basic functionality but struggle with complex system design
- **Dataset available:** Yes (GitHub)
- **TypeScript compatible:** Mixed (depends on project category)
- **URLs:**
  - Paper: https://arxiv.org/abs/2602.01655
  - GitHub: https://github.com/zsworld6/projdevbench

### 14. ProdCodeBench -- Production-Derived Benchmark

- **Published:** April 2, 2026 (Meta, arXiv)
- **What it tests:** Real developer-agent sessions from production. Verbatim prompts, committed code changes, fail-to-pass tests across 7 programming languages.
- **Scores:**
  - Claude Opus 4.5: **72.2%** (best)
  - Range across 4 models: **53.2% to 72.2%**
- **Dataset available:** Methodology shared (Meta internal data)
- **TypeScript compatible:** YES -- spans 7 languages including TypeScript
- **URLs:**
  - Paper: https://arxiv.org/abs/2604.01527

### 15. LoCoBench -- Long-Context Software Engineering

- **Published:** September 2025 (arXiv)
- **What it tests:** 8,000 scenarios across 10 programming languages, context lengths 10K to 1M tokens. Cross-file refactoring, architectural reasoning.
- **Scores:**
  - Gemini-2.5-Pro: highest overall LCBS
  - Consistent performance gaps as context increases from 10K to 1M tokens
- **Dataset available:** Yes
- **TypeScript compatible:** YES -- covers 10 languages
- **URLs:**
  - Paper: https://arxiv.org/abs/2509.09614
  - Agent variant: https://arxiv.org/abs/2511.13998

### 16. CodeElo -- Competitive Programming Elo Ratings

- **Published:** January 2025 (Qwen team)
- **What it tests:** Competition-level code generation using Codeforces problems with human-comparable Elo ratings. Submissions judged by the actual platform.
- **Scores:**
  - o1-mini (best): Elo **1578** (surpasses 90% of humans)
  - QwQ-32B-Preview (best open-source): Elo **1261**
  - Models struggle most with: dynamic programming, trees
  - Models perform best with: math, implementation
- **Dataset available:** Yes (GitHub)
- **TypeScript compatible:** No (C++ dominant)
- **URLs:**
  - Website: https://codeelo-bench.github.io/
  - GitHub: https://github.com/QwenLM/CodeElo
  - Paper: https://arxiv.org/abs/2501.01257

### 17. SafeGenBench -- Secure Code Generation

- **Published:** June 2025 (arXiv)
- **What it tests:** 558 code generation prompts across 12 languages including TypeScript. Tests security vulnerability detection using OWASP Top-10 and CWE Top 25 (44 CWE types).
- **Scores:**
  - Average accuracy across all models (zero-shot): **37.44%**
  - Explicit safety prompts + few-shot adversarial examples raise accuracy by 20-25%
- **Dataset available:** Yes
- **TypeScript compatible:** YES -- covers 12 languages including TypeScript
- **URLs:**
  - Paper: https://arxiv.org/abs/2506.05692

### 18. FrontierMath -- Research-Level Mathematics

- **Published:** November 2024 (Epoch AI), ongoing 2026
- **What it tests:** 300 Tier 1-3 problems (undergrad to early postdoc) + 50 Tier 4 (research-level). All original and unpublished.
- **Scores:**
  - GPT-5.4 Pro: **50% (Tiers 1-3)**, **38% (Tier 4)** -- new record
  - Average across all models: **0.233**
  - Second-place model: barely a quarter of benchmark
- **Dataset available:** Private (Epoch AI manages)
- **TypeScript compatible:** No (math/proof focused)
- **URLs:**
  - Website: https://epoch.ai/frontiermath/
  - Paper: https://arxiv.org/abs/2411.04872

---

## BONUS: Benchmarks Showing Saturation (For Context)

| Benchmark | SOTA Score | Status |
|-----------|-----------|--------|
| HumanEval | 99.4% | DEAD -- completely saturated |
| MBPP | 94.2% | DEAD -- saturated |
| SWE-Bench Verified | ~80.9% | CONTAMINATED -- OpenAI stopped reporting |
| LiveCodeBench (overall) | 91.7% | Approaching saturation at top |
| Aider Polyglot | ~85% | Still useful but narrowing |

---

## Which Benchmarks Work with TypeScript?

| Benchmark | TypeScript? | Notes |
|-----------|-------------|-------|
| Web-Bench | YES | Core focus -- web standards and frameworks |
| SWE-Bench Pro | YES | Includes TS and JS tasks |
| ProdCodeBench | YES | 7 languages including TS |
| LoCoBench | YES | 10 languages |
| SafeGenBench | YES | 12 languages including TS |
| FeatureBench | Partial | Python-dominant but extensible |
| Terminal-Bench | No | CLI/terminal tasks |
| ARC-AGI-3 | No | Environment-based |
| Frontier-CS | Partial | Algorithmic track is C++ |
| VeriBench | No | Lean 4 only |
| FLTEval | No | Lean 4 only |

---

## Recommended Benchmarks for a "Super Coder" Evaluation

If you want to build a benchmark suite that truly tests the limits, here are the top picks ranked by difficulty:

### The Unholy Trinity (models score <15%)
1. **ARC-AGI-3** -- Tests genuine learning and adaptation (0.26% for top models)
2. **FeatureBench** -- Tests real feature development (11-12.5%)
3. **VeriBench** -- Tests formal verification (12.5% raw)

### The Brutal Middle (models score 15-30%)
4. **Web-Bench** -- Tests web development end-to-end (25.1% SOTA) -- **TypeScript native**
5. **SWE-Bench Pro** (SWE-Agent) -- Multi-language engineering (23.1-23.3%)
6. **SWE-EVO** -- Long-horizon evolution (25%)
7. **SWE-CI** -- Maintenance over time (<25% zero-regression for most models)

### The Differentiators (models score 30-50%)
8. **SWE-Bench Pro** (SEAL) -- Standardized scaffolding (41-46%)
9. **IndustryCode** (main problems) -- Industrial domains (42.5%)
10. **FrontierMath Tier 4** -- Research math (38%)

---

## Key Takeaways

1. **The hardest benchmarks are agentic and multi-step.** Single-function code generation is solved. The frontier is now multi-file, multi-commit, multi-day engineering.

2. **Formal verification is an extreme differentiator.** VeriBench and FLTEval show that proving code correct remains nearly impossible for raw LLMs without specialized agent loops.

3. **Web-Bench is the best TypeScript-native hard benchmark.** At 25.1% SOTA and 10.7% average for open-source, it is far from saturated and directly tests web development skills.

4. **SWE-CI reveals a hidden failure mode.** Models can pass tests once but break everything during long-term maintenance -- 75% of models fail at this.

5. **ARC-AGI-3 is in a class of its own.** At <1% for all frontier models, it tests something fundamentally different: the ability to learn from interaction without instructions.

6. **Contamination is now a first-class concern.** SWE-Bench Verified is compromised. LiveCodeBench, FeatureBench, and Frontier-CS are designed to resist contamination through rolling updates or genuinely novel problems.

---

## Sources

- [MorphLLM: AI Coding Benchmarks 2026](https://www.morphllm.com/ai-coding-benchmarks-2026)
- [Scale AI SWE-Bench Pro Leaderboard](https://labs.scale.com/leaderboard/swe_bench_pro_public)
- [ARC Prize 2026](https://arcprize.org/blog/arc-agi-3-launch)
- [FeatureBench (ICLR 2026)](https://arxiv.org/abs/2602.10975)
- [Web-Bench Paper](https://arxiv.org/html/2505.07473v1)
- [Frontier-CS](https://github.com/FrontierCS/Frontier-CS)
- [Terminal-Bench 2.0](https://www.vals.ai/benchmarks/terminal-bench-2)
- [SWE-CI Paper](https://arxiv.org/html/2603.03823v1)
- [SWE-EVO Paper](https://arxiv.org/abs/2512.18470)
- [VeriBench](https://openreview.net/forum?id=rWkGFmnSNl)
- [Mistral Leanstral / FLTEval](https://mistral.ai/news/leanstral)
- [ProdCodeBench](https://arxiv.org/abs/2604.01527)
- [IndustryCode](https://arxiv.org/abs/2604.02729)
- [ProjDevBench](https://arxiv.org/abs/2602.01655)
- [LoCoBench](https://arxiv.org/abs/2509.09614)
- [CodeElo](https://codeelo-bench.github.io/)
- [SafeGenBench](https://arxiv.org/abs/2506.05692)
- [FrontierMath](https://epoch.ai/frontiermath/)
- [USACO Benchmark](https://princeton-nlp.github.io/USACOBench/)
- [LiveCodeBench](https://livecodebench.github.io/)
- [BigCodeBench-Hard](https://huggingface.co/blog/terryyz/bigcodebench-hard)
- [Snorkel Agentic Coding Benchmark](https://snorkel.ai/blog/introducing-the-snorkel-agentic-coding-benchmark/)
- [MIT Technology Review: AI benchmarks are broken](https://www.technologyreview.com/2026/03/31/1134833/ai-benchmarks-are-broken-heres-what-we-need-instead/)
