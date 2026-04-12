# Hardest Coding Benchmarks (April 2026)

Benchmarks where frontier models score BELOW 50%, with sources for actual tasks.

---

## Summary: Where Models Still Fail

| Benchmark | Best Score | Claude Sonnet 4.6 Est. | Tasks | Actual Tasks Available? |
|---|---|---|---|---|
| **FeatureBench** | 12.5% (GPT-5.1-Codex) | ~8-9% (est. from Opus 4.5 at 11%) | 200 | Yes - GitHub + HuggingFace |
| **SWE-bench Pro (Public)** | 59.1% (GPT-5.4-pro xHigh) | 43.6% (Claude 4.5 Sonnet) | 731 (public) | Yes - GitHub |
| **SWE-bench Pro (Private)** | 17.8% (Opus 4.1) | ~12% (est.) | 403 | No - proprietary codebases |
| **LiveCodeBench Pro (Hard)** | 0% (all models) | 0% | ~195 hard | Yes - GitHub |
| **Web-Bench** | 25.1% (Claude 3.7 Sonnet) | ~30% (est.) | 1000 (50x20) | Yes - GitHub |
| **USACO Platinum** | 69.7% (GPT-5 Medium) | ~25% (est. from 3.7 Sonnet at 29%) | 307 | Yes - GitHub + HuggingFace |
| **BigCodeBench-Hard Instruct** | <50% (GPT-4o best) | ~40% (est.) | 148 | Yes - GitHub + HuggingFace |
| **Terminal-Bench 2.0 (full)** | 82.9% (Pilot+Opus 4.6) | ~55% (bare model) | 89 | Yes - GitHub |

---

## 1. FeatureBench -- THE HARDEST (Best: 12.5%)

### What It Is
End-to-end feature implementation in real open-source repositories. Not bug fixing -- building NEW features from scratch or extending existing codebases. Each task requires implementing a callable interface that passes comprehensive test suites.

### Scores (February 2026)
| Agent + Model | Resolved Rate (Full) |
|---|---|
| Codex + GPT-5.1-Codex (medium reasoning) | **12.5%** |
| Claude Code (routing) + Claude Opus 4.5 | **11.0%** |
| All other configurations | **<11%** |

Claude Sonnet 4.6 is not directly reported but given Opus 4.5 scores 11%, Sonnet likely scores 8-9%.

### Why It Is Hard
- Tasks span multiple commits and PRs across development timelines
- Requires writing substantial new code (not just patches)
- Must pass both fail-to-pass AND pass-to-pass test suites
- Two difficulty levels: L1 (extend existing repo) and L2 (build from scratch)
- All models consume >1M input tokens per task

### Task Examples
- Adapting the Transformers library for compatibility with Qwen3
- Engineering FlashAttention integration
- Feature development across 24 Python repositories covering ML, scientific computing, visualization, web frameworks

### Where to Get Tasks
- **GitHub**: https://github.com/LiberCoders/FeatureBench
- **Dataset**: https://huggingface.co/datasets/LiberCoders/FeatureBench
- **Paper**: https://arxiv.org/html/2602.10975
- **Format**: SWE-bench compatible (instance_id, patch, test_patch, FAIL_TO_PASS, PASS_TO_PASS, Docker image)
- **Language**: Python only (24 repositories)

### Integration Feasibility
MODERATE. Tasks are Python/Docker-based. Would need a wrapper to run Docker environments and check test results, then report pass/fail back to vitest. Could extract the problem statements and interface definitions as standalone coding challenges for a TypeScript adaptation.

---

## 2. SWE-bench Pro -- Enterprise-Grade (Best Public: 59.1%)

### What It Is
Long-horizon software engineering tasks from diverse, complex codebases including consumer apps, B2B services, and developer tools. Uses strong copyleft licenses (GPL) to reduce contamination. Includes a private subset with proprietary startup codebases.

### Scores (April 2026, uncapped cost, 250 turn limit)
| Rank | Model | Public Score |
|---|---|---|
| 1 | GPT-5.4-pro (xHigh)* | 59.10% |
| 1 | Muse Spark* | 55.00% |
| 2 | Claude Opus 4.6 (thinking)* | 51.90% |
| 3 | Gemini 3.1 Pro (thinking)* | 46.10% |
| 3 | Claude Opus 4.5 | 45.89% |
| 4 | **Claude 4.5 Sonnet** | **43.60%** |
| 4 | Gemini 3 Pro Preview | 43.30% |
| 4 | **Claude 4 Sonnet** | **42.70%** |
| 4 | GPT-5 (High) | 41.78% |
| 4 | GPT-5.2-codex | 41.04% |
| 4 | Claude 4.5 Haiku | 39.45% |
| 6 | Qwen3-coder-480b | 38.70% |
| 15 | GPT-5.2 | 29.94% |
| 17 | Qwen3-235b | 21.41% |
| 25 | Codestral-2405 | 1.51% |

*Run with mini-swe-agent harness

**Private subset is harder**: Opus 4.1 drops from 22.7% to 17.8%, GPT-5 drops from 23.1% to 14.9%.

### Why It Is Hard
- 1865 total tasks across 41 professional repositories
- Tasks require edits across multiple files
- Includes bug fixes, feature requests, optimizations, security updates, UI/UX changes
- Private codebases have zero training data contamination
- Much longer horizon than SWE-bench Verified

### Where to Get Tasks
- **GitHub**: https://github.com/scaleapi/SWE-bench_Pro-os
- **Paper**: https://scale.com/research/swe_bench_pro
- **Leaderboard**: https://labs.scale.com/leaderboard/swe_bench_pro_public
- **Trajectories**: https://docent.transluce.org/dashboard/032fb63d-4992-4bfc-911d-3b7dafcb931f
- **Format**: Docker-based, fail-to-pass test verification

### Integration Feasibility
MODERATE-HIGH. Same SWE-bench format as original. Docker environments. Would need to extract specific hard instances and adapt for our runner. The public set (731 instances) is fully accessible.

---

## 3. LiveCodeBench Pro -- Hard Tier: 0% Pass Rate

### What It Is
584 high-quality competitive programming problems curated by Olympiad medalists, with Elo-based difficulty tiers. Problems are sourced from active contests and tagged by medalist-led auditing.

### Difficulty Tiers
- **Easy**: <=2000 Elo
- **Medium**: 2000-3000 Elo
- **Hard**: >3000 Elo (THIS IS WHERE 0% HAPPENS)

### Scores
| Model | Easy | Medium | Hard |
|---|---|---|---|
| Best models | High | ~53% pass@1 | **0%** |
| o4-mini (pass@k) | Improves | Improves | **Still 0%** |

On hard problems (>3000 Elo), ALL models score 0% even with multiple attempts. The pass rate flatlines regardless of retry sampling.

**Elo Ratings (overall)**:
- Gemini 3.1 Pro: 2887
- GPT-5.2: 2393
- Gap of ~500 Elo points between top models on hardest problems

### Why It Is Hard
- Problems require nuanced algorithmic reasoning beyond implementation
- Complex case analysis that brute-force and tool-augmented approaches cannot solve
- Contamination-free (problems from active contests)
- Even pass@10 cannot breach the 0% barrier on Hard tier

### Where to Get Tasks
- **GitHub**: https://github.com/GavinZhengOI/LiveCodeBench-Pro
- **Paper**: https://arxiv.org/abs/2506.11928
- **Evaluation**: Uses LightCPVerifier for judging
- **Format**: Python-based benchmark runner with API interface

### Integration Feasibility
HIGH. Competitive programming problems are self-contained. Could translate problem statements to TypeScript test cases. The 0%-pass Hard tier problems are pure algorithmic challenges that work in any language.

---

## 4. Web-Bench -- Full-Stack Web Dev (SOTA: 25.1%)

### What It Is
50 web development projects, each with 20 sequentially-dependent tasks (1000 total tasks). Projects are designed by engineers with 5-10 years of experience. Each project takes 4-8 hours for a senior engineer to complete.

### Scores
| Model | Pass@1 |
|---|---|
| Claude 3.7 Sonnet (SOTA at paper time) | **25.1%** |
| Other models | Lower |

Note: This was measured with Claude 3.7 Sonnet. Newer models like Sonnet 4.6 would likely score higher but the benchmark remains far from saturated.

### Why It Is Hard
- Sequential dependencies between tasks within a project
- Covers both Web Standards (vanilla JS, CSS, HTML) and Web Frameworks (React, Vue, etc.)
- Real-world complexity: projects simulate actual development workflows
- HumanEval/MBPP are saturated; Web-Bench SOTA is only 25.1%

### Task Examples
Projects cover: Canvas/SVG rendering, CSS Grid/Flexbox layouts, WebSocket real-time apps, IndexedDB persistence, Service Workers, React state management, Vue component trees, full CRUD applications.

### Where to Get Tasks
- **GitHub**: https://github.com/bytedance/web-bench
- **Paper**: https://arxiv.org/abs/2505.07473
- **Format**: Docker-based evaluation, config.json5 for model selection
- **Language**: JavaScript/TypeScript/HTML/CSS (web-native)

### Integration Feasibility
HIGHEST. This is already web/JS/TS-based. Tasks use React, vanilla JS, CSS -- directly compatible with our vitest setup. The sequential task dependency structure is particularly interesting for testing multi-step reasoning. Could directly adapt task definitions as vitest test suites.

---

## 5. Terminal-Bench 2.0 -- Real-World Terminal Tasks (89 tasks)

### What It Is
89 tasks requiring AI agents to operate inside real terminal environments (Docker containers). Spans software engineering, security, biology, and gaming domains.

### Scores (April 2026)
| Rank | Agent + Model | Score |
|---|---|---|
| 1 | Pilot + Claude Opus 4.6 | 82.9% |
| 2 | ForgeCode + GPT-5.4 | 81.8% |
| 3 | ForgeCode + Claude Opus 4.6 | 81.8% |
| 4 | TongAgents + Gemini 3.1 Pro | 80.2% |
| 5 | SageAgent + GPT-5.3-Codex | 78.4% |
| ... | ... | ... |
| 26 | Claude Code (bare) | 58.0% |
| ... | ... | ... |
| 115 | Terminus 2 + GPT-OSS-20B | 3.1% |

Top agents with frontier models score 75-83%. But bare model usage (without sophisticated scaffolding) drops significantly. The gap between agent scaffolds shows scaffolding matters as much as model quality.

### Task Examples
- **build-linux-kernel-qemu**: Build linux kernel 6.9 from source, add custom printk, boot with QEMU
- **configure-git-webserver**: Set up git server with post-receive hooks pushing to port 8080 webserver
- **crack-7z-hash**: Extract password from encrypted 7z archive
- **openssl-selfsigned-cert**: Create self-signed TLS certificate with specific requirements
- Protein assembly for synthesis, debugging async code, resolving security vulnerabilities

### Where to Get Tasks
- **GitHub**: https://github.com/laude-institute/terminal-bench
- **Website**: https://www.tbench.ai/
- **Leaderboard**: https://www.tbench.ai/leaderboard/terminal-bench/2.0
- **Paper**: https://arxiv.org/abs/2601.11868
- **Format**: Harbor framework, Docker-containerized tasks

### Integration Feasibility
LOW-MODERATE. Tasks require Docker environments and terminal interaction. Not directly convertible to vitest. However, task descriptions could be adapted as specification documents for code generation challenges.

---

## 6. USACO -- Olympiad Programming (Best: 69.7%)

### What It Is
307 competitive programming problems from the USA Computing Olympiad, spanning Bronze through Platinum difficulty. Problems test algorithmic knowledge including data structures, dynamic programming, graph algorithms, and mathematical reasoning.

### Scores (HAL Leaderboard)
| Rank | Scaffold | Model | Accuracy |
|---|---|---|---|
| 1 | USACO Episodic + Semantic | GPT-5 Medium (Aug 2025) | 69.71% |
| 2 | USACO Episodic + Semantic | o4-mini High | 57.98% |
| 3-7 | Various | Various | 38-54% |
| 8 | USACO Episodic + Semantic | DeepSeek R1 | 38.11% |
| 9 | USACO Episodic + Semantic | o4-mini Low | 30.94% |
| 10 | USACO Episodic + Semantic | Claude 3.7 Sonnet | 29.32% |
| 11 | USACO Episodic + Semantic | Gemini 2.0 Flash | 27.04% |

**Platinum-level problems** are where models truly struggle. GPT-4 zero-shot scores only 8.7% overall.

### Where to Get Tasks
- **Leaderboard**: https://hal.cs.princeton.edu/usaco
- **Paper**: https://arxiv.org/abs/2404.10952
- **Project**: https://princeton-nlp.github.io/USACOBench/
- **Tasks**: 307 problems with exhaustive test cases, reference code, and official analyses
- **Format**: Standard competitive programming (stdin/stdout)

### Integration Feasibility
HIGH. Competitive programming problems are language-agnostic. Can translate to TypeScript with stdin/stdout wrappers or direct function signatures. Test cases are already available.

---

## 7. Aider Polyglot -- Multi-Language Code Editing (Top: 88%)

### What It Is
225 challenging Exercism coding exercises across C++, Go, Java, JavaScript, Python, and Rust. Tests ability to follow instructions AND edit code (not just generate). Models get two attempts per problem.

### Scores (Latest)
| Model | Score | Cost |
|---|---|---|
| GPT-5 (high) | 88.0% | $29.08 |
| GPT-5 (medium) | 86.7% | $17.69 |
| o3-pro (high) | 84.9% | $146.32 |
| Claude Opus 4.6 (est.) | ~85% | - |
| Claude Opus 4 (no think) | 70.7% | $68.63 |
| Gemini 2.5 Pro | 72.9% | - |
| DeepSeek R1 | 70.7% | - |
| gpt-4o-mini | 3.6% | $0.32 |

This benchmark is mostly SOLVED by frontier models (88% top). Not ideal for our "hardest" category, but the remaining ~12% unsolved exercises are genuinely hard multi-language challenges.

### Where to Get Tasks
- **Leaderboard**: https://aider.chat/docs/leaderboards/
- **GitHub**: https://github.com/Aider-AI/aider/tree/main/benchmark
- **Tasks**: 225 Exercism problems
- **Format**: File editing with test verification

### Integration Feasibility
HIGH for the unsolved subset. JavaScript and Rust exercises could directly map to vitest. The interesting angle is extracting the ~25-30 exercises that NO model solves.

---

## 8. BigCodeBench-Hard -- Complex API Usage (Best: <50%)

### What It Is
148 tasks requiring complex multi-library function calls in Python, selected from the harder problems in BigCodeBench (1,140 total tasks covering 723 function calls from 139 libraries across 7 domains).

### Scores
- GPT-4o (best at time of paper): ~60% on Complete, **<50% on Instruct**
- Human performance: **97%**
- Gap: 37+ percentage points between frontier models and humans

### Why It Is Hard
- Requires precise use of real library APIs (not toy functions)
- Multi-library composition in single tasks
- Instruction-following is the bottleneck (Instruct variant is harder than Complete)

### Where to Get Tasks
- **GitHub**: https://github.com/bigcode-project/bigcodebench
- **HuggingFace**: https://huggingface.co/blog/terryyz/bigcodebench-hard
- **Leaderboard**: https://bigcode-bench.github.io/
- **Format**: Python with test verification

### Integration Feasibility
LOW-MODERATE. Python-only with heavy library dependencies. Would need significant adaptation for TypeScript. The API-usage pattern testing is interesting conceptually but hard to port.

---

## 9. AppBench / WebCoderBench -- Full App Generation

### AppBench
9 diverse web app generation tasks evaluated across 180 generation attempts. Focuses on one-shot generation with zero human edits. Tasks combining multi-step logic, rich UI, and multi-user roles trip up the majority of tools.

- **Website**: https://appbench.ai/

### WebCoderBench
Comprehensive benchmarking of web application generation with interpretable evaluation metrics.

- **Paper**: https://arxiv.org/abs/2601.02430

### Integration Feasibility
MODERATE. Web-focused, could align with our stack. AppBench is small (9 tasks) but each is complex and well-defined.

---

## Priority Ranking for Integration

Based on difficulty (models score <50%), task availability, and compatibility with our vitest/TypeScript setup:

### Tier 1: Integrate These First
1. **LiveCodeBench Pro Hard** (0% pass rate, algorithmic, language-agnostic)
2. **Web-Bench** (25.1% SOTA, already JS/TS/HTML/CSS, Docker-ready)
3. **FeatureBench** (11% best score, open dataset, but Python-only)

### Tier 2: High Value, More Adaptation Needed
4. **SWE-bench Pro** (43% Sonnet, open public set, Docker-based)
5. **USACO Platinum** (29% Claude 3.7, competitive programming, portable)
6. **BigCodeBench-Hard Instruct** (<50%, but Python-only)

### Tier 3: Supplementary
7. **Terminal-Bench 2.0** (requires Docker/terminal interaction)
8. **Aider Polyglot unsolved subset** (already has JS/Rust exercises)
9. **AppBench** (small but interesting full-stack tasks)

---

## Concrete Next Steps

### Quick Wins (can do this week)
1. Clone LiveCodeBench-Pro repo, extract Hard tier problems, translate 10-20 to TypeScript vitest
2. Clone Web-Bench repo, extract 5 projects, test with our agent directly (already JS/TS)
3. Download FeatureBench from HuggingFace, examine task format, identify tasks portable to TS

### Medium-Term (1-2 weeks)
4. Build Docker runner integration for SWE-bench Pro public set
5. Port 20 USACO Platinum problems to TypeScript with test cases
6. Create a "composite hard benchmark" mixing tasks from multiple sources

### Key Repos to Clone
```bash
git clone https://github.com/LiberCoders/FeatureBench
git clone https://github.com/scaleapi/SWE-bench_Pro-os
git clone https://github.com/GavinZhengOI/LiveCodeBench-Pro
git clone https://github.com/bytedance/web-bench
git clone https://github.com/laude-institute/terminal-bench
git clone https://github.com/bigcode-project/bigcodebench
```

---

## Sources

- [FeatureBench Paper](https://arxiv.org/html/2602.10975) | [GitHub](https://github.com/LiberCoders/FeatureBench) | [Dataset](https://huggingface.co/datasets/LiberCoders/FeatureBench)
- [SWE-bench Pro Leaderboard](https://labs.scale.com/leaderboard/swe_bench_pro_public) | [GitHub](https://github.com/scaleapi/SWE-bench_Pro-os) | [Paper](https://scale.com/research/swe_bench_pro)
- [LiveCodeBench Pro Paper](https://arxiv.org/abs/2506.11928) | [GitHub](https://github.com/GavinZhengOI/LiveCodeBench-Pro)
- [Web-Bench Paper](https://arxiv.org/abs/2505.07473) | [GitHub](https://github.com/bytedance/web-bench)
- [Terminal-Bench 2.0 Leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/2.0) | [GitHub](https://github.com/laude-institute/terminal-bench) | [Paper](https://arxiv.org/abs/2601.11868)
- [HAL USACO Leaderboard](https://hal.cs.princeton.edu/usaco) | [Paper](https://arxiv.org/abs/2404.10952)
- [Aider Polyglot Leaderboard](https://aider.chat/docs/leaderboards/)
- [BigCodeBench](https://github.com/bigcode-project/bigcodebench) | [Leaderboard](https://bigcode-bench.github.io/)
- [AppBench](https://appbench.ai/)
- [Morphllm AI Coding Benchmarks 2026](https://www.morphllm.com/ai-coding-benchmarks-2026)
- [SWE-bench Pro Analysis](https://www.morphllm.com/swe-bench-pro)
- [Terminal-Bench 2.0 Analysis](https://www.morphllm.com/terminal-bench-2)
