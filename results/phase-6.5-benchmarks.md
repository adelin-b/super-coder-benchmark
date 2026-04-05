# Phase 6.5 — Hard Benchmarks Survey

**Date:** 2026-04-06
**Purpose:** Current benchmark (11 textbook tasks) is saturated — all methods clustering at ~82%. We need harder, real-world, contamination-resistant tasks sourced from **existing public benchmarks** to differentiate verification methods and push toward a "bug-free TS agent".
**Model cutoff to beat for contamination:** Claude Opus 4.6 training cutoff ~ **May 2025**.

> **Hard rule:** only real, published benchmarks are cited. Every URL was verified via WebSearch/WebFetch on 2026-04-06.

---

## (a) Master Recap Table

| # | Benchmark | Org / Authors | Year / Last Update | Tasks | Language(s) | Task type | Difficulty (frontier pass) | Contam-free? | Access | TS fit | **Suit 1-10** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **SWE-bench Verified** | Princeton / OpenAI | 2023 → ongoing | **500** | Python | Real issue → PR | ~65% (Claude 3.7) | Pre-2024 | HF dataset, pip `swebench` | low (Py) | 7 |
| 2 | **SWE-bench Multilingual** | Princeton | 2024 | **300** across 42 repos | C, C++, Go, Java, **JS**, **TS**, PHP, Ruby, Rust | Real issue → PR | hard | Pre-2024 | HF | **high** | **9** |
| 3 | **Multi-SWE-bench** (ByteDance) | ByteDance Seed | NeurIPS 2025 | **1,632** (mini: 400, flash subset) | Java, **TS**, **JS**, Go, Rust, C, C++ | Real issue → PR | hard | partially post-cutoff | HF `ByteDance-Seed/Multi-SWE-bench` | **high** | **9** |
| 4 | **SWE-PolyBench** | Amazon Science | ICLR 2025 | **2,110** (Verified: 382, 500-subset) | Java, **JS (1,017)**, **TS (729)**, Py | Real issue → PR | hard | mostly pre-cutoff | HF `AmazonScience/SWE-PolyBench` | **very high** | **10** |
| 5 | **SWE-Lancer** | OpenAI | Feb 2025 | **1,400+** (Diamond public subset) | **TS**/JS heavy (Expensify monorepo), Py | Freelance bug-fix + feature | Claude 3.5 earns ~$400k/$1M | partially post-cutoff | GH `openai/SWELancer-Benchmark` (Docker) | **very high** | **10** |
| 6 | **BugsJS** | Gyimesi et al., U. Szeged / UBC | 2019 (STVR 2021) | **453** | JavaScript (server-side) | Real bug repair, Mocha | classic, pre-LLM era | Likely contaminated | GH `BugsJS/bug-dataset` | **high** | **8** |
| 7 | **ts-bench** | laiso | 2025, still updated | 25 (v1 Exercism) + SWE-Lancer v2 | **TypeScript** | Agent-level bench | simple v1, hard v2 | Exercism likely contaminated | GH `laiso/ts-bench` | **very high** | 7 |
| 8 | **Web-Bench** | ByteDance | arXiv 2505.07473 (May 2025) | **50 projects × 20 tasks = 1,000** | JS/TS + web frameworks | Sequential feature impl | Claude 3.7 Sonnet **25.1% pass@1** | **post-cutoff** | GH `bytedance/web-bench` | **very high** | **9** |
| 9 | **LiveCodeBench v6** | UC Berkeley et al. | arXiv 2403.07974, v6 = Apr 2025 | 1,055 (May 23 → Apr 25) | Python primarily | Competitive (LC, AtCoder, CF) | hard | **contamination-free by design** (time-segmented) | GH `LiveCodeBench/LiveCodeBench` | low (Py) | 6 |
| 10 | **BigCodeBench** | BigCode / HF | ICLR 2025 | 1,140 (Hard: ~150) | Python (complex API calls) | Function gen w/ libs | Hard set ~30-40% | pre-cutoff | GH `bigcode-project/bigcodebench` | low | 5 |
| 11 | **Aider Polyglot** | Paul Gauthier / Aider | 2024 → live leaderboard | **225** | C++, Go, Java, **JS**, Py, Rust | Exercism hardest tier | hard | Exercism — contaminated | GH `Aider-AI/aider` + Exercism | medium | 6 |
| 12 | **CrossCodeEval** | Amazon | NeurIPS 2023 | ~10k | Py, Java, **TS**, C# | Cross-file completion | repo-context | pre-cutoff | GH `amazon-science/cceval` | high | 7 |
| 13 | **RepoBench v1.1** | Leolty | ICLR 2024, updated Feb 2024 | large (R/C/P splits) | Py, Java | Repo-level completion | medium-hard | 2024 data | HF `tianyang/repobench_...` | low | 5 |
| 14 | **SWE-Gym** | Berkeley / CMU | ICML 2025 | **2,438** (Lite: 230) | Python | Train env for agents | paired w/ SWE-bench | 2024- | HF `SWE-Gym/SWE-Gym` | low | 5 |
| 15 | **R2E-Gym** | Berkeley | COLM 2025 | **8,100+** across 13 repos | Python | Procedural env SWE | 51% on SWE-bench Verified | 2024- | GH `R2E-Gym/R2E-Gym` | low | 5 |
| 16 | **SWE-bench Multimodal** | Princeton | 2024, public Jan 2025 | **517** | JS (web UI) | Issue + screenshot | hard | partially pre-cutoff | HF | high | 7 |
| 17 | **SWE-bench Live** (MS) | Microsoft | NeurIPS 2025 D&B | continuously updated | Python + more | Monthly refresh | **contamination-free** (rolling) | **yes** | GH `microsoft/SWE-bench-Live` | medium | 8 |
| 18 | **Long Code Arena** | JetBrains Research | 2024 | 6 sub-benchmarks | Py, Java, Kotlin | Long-context SWE | hard | 2024 | GH `JetBrains-Research/lca-baselines` | low-med | 5 |
| 19 | **LongCodeBench** | Zteefano et al. | arXiv 2505.07897 (May 2025) | long-ctx GH issues | Python | 1M ctx QA + repair | hard | **post-cutoff** | GH `Zteefano/long-code-bench` | low | 6 |
| 20 | **Defects4J** | Just et al. | 2014, v3 active | **854** | Java | Classic APR | saturated | heavily contaminated | GH `rjust/defects4j` | none | 3 |
| 21 | **BugsInPy** | Widyasari et al. | 2020, maintained | 493 | Python | Real bug repair | saturated on LLMs | contaminated | GH `soarsmu/BugsInPy` | none | 3 |
| 22 | **QuixBugs** | Koppel / Lin / Polikarpova | 2017 | **40** | Py + Java | Single-line repair | trivially solved | heavily contaminated | GH `jkoppel/QuixBugs` | none | 2 |
| 23 | **ManyBugs / IntroClass** | UMass / CMU | 2015 | 185 + 998 | C | Historical APR | saturated | contaminated | repairbenchmarks.cs.umass.edu | none | 2 |
| 24 | **DebugBench** | Tsinghua | ACL 2024 | ~4k | Py, C++, Java | Injected bugs on LeetCode | medium | LeetCode contaminated | GH `thunlp/DebugBench` | none | 4 |
| 25 | **APPS** | Hendrycks et al. | NeurIPS 2021 | **10,000** | Python | Competitive | saturated top end | heavily contaminated | GH `hendrycks/apps` | none | 3 |
| 26 | **CodeContests** | DeepMind | 2022 | ~13.5k | multi | Competitive | saturated | heavily contaminated | GH `google-deepmind/code_contests` | low | 3 |
| 27 | **EvalPlus (HumanEval+/MBPP+)** | Liu et al. | NeurIPS 2023 | 164 + 378 | Python | Extended tests | saturated (~95%) | fully contaminated | GH `evalplus/evalplus` | none | 2 |
| 28 | **ClassEval** | FudanSELab | 2023 | 100 classes | Python | Class-level gen | medium | contaminated | GH `FudanSELab/ClassEval` | none | 3 |
| 29 | **CoderEval** | CoderEval team | 2023 | 230 Py + 230 Java | Py/Java | Function gen in project | medium | contaminated | GH `CoderEval/CoderEval` | none | 3 |
| 30 | **MultiPL-E (HumanEval-TS)** | Cassano et al. | TSE 2023 | 164 × 18 langs | incl. **TS** | Translated HumanEval | saturated | fully contaminated | GH `nuprl/MultiPL-E` | medium | 3 |
| 31 | **CWEval-bench** | ARISE Lab | 2025 | **119** risky tasks, 31 CWEs | Py, **JS**, C++, C, Go | Security + functionality | hard | partially post-cutoff | GH `arise-lab/cweval` | **high** | **8** |
| 32 | **CVE-Bench** | NAACL 2025 | 2025 | **509 CVEs**, 120 repos | 4 langs incl JS | Real CVE repair | very hard | partially post-cutoff | paper 2025.naacl-long.212 | high | 7 |
| 33 | **SEC-Bench** | arXiv 2506.11791 | Jun 2025 | security tasks | multi | PoC + patch | 26-34% | **post-cutoff** | arXiv only | medium | 6 |
| 34 | **SecureAgentBench** | 2025 | late 2025 | **105** | multi | Multi-file secure gen | hard | **post-cutoff** | paper | medium | 6 |
| 35 | **cwe-bench-java** | iris-sast | 2024-2025 | 120 CVEs, 4 CWEs | Java | Static vuln detection | hard | pre-cutoff | GH `iris-sast/cwe-bench-java` | none | 3 |

---

## (b) Top 8 Recommendations for Immediate Integration (ranked)

All eight are chosen to (i) be TS/JS relevant, (ii) push past saturation, and (iii) allow hand-picking 3-5 hand-portable tasks that fit our `references/<TASK>/{spec.md, impl.ts, impl.test.ts}` format.

1. **SWE-PolyBench (Verified, TS slice — 729 TS tasks)** — Suit **10**
2. **SWE-Lancer Diamond (TypeScript Expensify monorepo)** — Suit **10**
3. **Multi-SWE-bench (TS + JS slice, NeurIPS 2025)** — Suit **9**
4. **SWE-bench Multilingual (TS + JS subset, 300 total)** — Suit **9**
5. **Web-Bench (ByteDance, post-cutoff, 1,000 seq tasks)** — Suit **9**
6. **BugsJS (453 real JS bugs, 10 OSS projects, Mocha)** — Suit **8**
7. **CWEval-bench (119 security+functional tasks incl. JS)** — Suit **8**
8. **SWE-bench Live (Microsoft, rolling contamination-free)** — Suit **8**

---

## (c) Concrete picking procedure per top-8

General adaptation pattern to our repo format:
- Create `references/<ID>/spec.md` — copy issue title + acceptance criteria, trim PII.
- `references/<ID>/impl.ts` — start from the buggy pre-patch file(s), simplified to a single self-contained module if possible (otherwise keep the full sub-directory in `references/<ID>/src/`).
- `references/<ID>/impl.test.ts` — port the upstream test patch to Vitest (most already are Mocha/Jest → mechanical).
- `references/<ID>/bugs/bug1-original.ts` → keep the original upstream bug; add 2-3 mutation variants with Stryker-style mutators for variety.

### 1. SWE-PolyBench (TS slice)
- Pull: `huggingface-cli download AmazonScience/SWE-PolyBench --repo-type dataset`
- Filter `language == "TypeScript"` → 729 rows; then filter to `SWE-PolyBench_Verified` → ~130 TS tasks.
- **Pick 5** with smallest `test_patch` diff (≤60 LoC) and single-file `patch` — e.g. from repos like `storybookjs/storybook`, `mui/material-ui`, `trpc/trpc`.
- For each row: `instance_id`, `problem_statement`, `patch`, `test_patch`, `base_commit` → materialise pre-patch file as `impl.ts`, apply `test_patch` to `impl.test.ts`.

### 2. SWE-Lancer Diamond (TS)
- Clone: `git clone https://github.com/openai/SWELancer-Benchmark`
- Use Docker image to list `--split diamond --category ic_swe` Upwork issues on Expensify (all TS).
- **Pick 3-5** $50–$250 bug-fix tasks (cheapest = smallest scope), extract the 1-3 modified files and end-to-end Playwright test.
- Adapt the Playwright test to a pure Vitest unit test when possible; otherwise keep the Playwright runner next to it.

### 3. Multi-SWE-bench (TS + JS slice)
- `datasets.load_dataset("ByteDance-Seed/Multi-SWE-bench_mini")`
- Filter `language in {"TypeScript","JavaScript"}` (mini = 400 rows total, ~80 TS/JS).
- **Pick 5** single-file fixes, ideally from `vercel/next.js`, `denoland/deno_std`, or `immerjs/immer` (those have clean Jest tests).
- Follow SWE-bench format: `problem_statement` → `spec.md`, pre-patch → `impl.ts`, `test_patch` → `impl.test.ts`.

### 4. SWE-bench Multilingual (TS/JS subset)
- `datasets.load_dataset("SWE-bench/SWE-bench_Multilingual")` → filter by language.
- Only ~30-40 TS+JS rows total; hand-pick **3** most scoped (smallest golden patch).
- Same extraction flow as Multi-SWE-bench.

### 5. Web-Bench (ByteDance, 50 × 20 sequential tasks)
- `git clone https://github.com/bytedance/web-bench`
- Each project is a sequence; grab **projects 1-2** from React + Next.js tracks and take tasks 1-5 from each (= 10 tasks).
- Each task already ships with Playwright tests — port to our `impl.test.ts` by keeping the Playwright harness as a separate runner.
- **Huge advantage:** published May 2025 = likely post-cutoff; SOTA is 25% pass@1.

### 6. BugsJS (453 bugs, Mocha)
- `git clone https://github.com/BugsJS/bug-dataset`
- Filter projects to ones with small modules: `bower`, `shields`, `node-redis`.
- **Pick 5** single-commit bugs with ≤50 LoC diff: they already ship `buggy/` and `fixed/` folders + original Mocha tests → ~1h port per task.
- Mocha → Vitest translation is nearly identical (`describe`/`it`/`assert`).

### 7. CWEval-bench (119 tasks, includes JS)
- `git clone https://github.com/arise-lab/cweval-bench` (path per `arise-lab.github.io/cweval-bench/`)
- Filter language = JavaScript → ~25 tasks.
- **Pick 5** covering distinct CWE classes (SQLi, path traversal, SSRF, XSS, crypto misuse).
- These ship **dual tests**: functional + security exploit → ideal differentiator for verification methods that claim security guarantees.

### 8. SWE-bench Live
- `git clone https://github.com/microsoft/SWE-bench-Live`
- Use the **most recent monthly release** (e.g. 2026-03) for guaranteed freshness.
- Pick 3 smallest-patch tasks across any language it supports.
- Use as a **rolling leaderboard** dataset: re-pull each quarter to detect leakage on your own benchmark.

---

## (d) Contamination note (Claude Opus 4.6 cutoff ≈ May 2025)

| Bench | Status vs. May-2025 cutoff | Recommendation |
|---|---|---|
| **Web-Bench** (arXiv 2505.07473) | Published 12 May 2025 — right at the line, source code post-dates most training | **USE as gold standard** for differentiation |
| **SWE-bench Live (MS)** | Monthly rolling, latest snapshots = 2026 | **USE for quarterly re-eval** |
| **LongCodeBench** (2505.07897) | May 2025 | safe |
| **SEC-Bench / SecureAgentBench** | June–Nov 2025 | safe |
| **Multi-SWE-bench** | Apr 2025 arXiv, NeurIPS 2025 | borderline — mini dataset likely safe |
| **SWE-Lancer** | Feb 2025 | borderline — issues themselves pre-date cutoff, but test harness + solutions released close to it |
| **SWE-PolyBench** | Apr 2025 | borderline — underlying issues are pre-cutoff GH, **test patches likely in training data** |
| **LiveCodeBench v6** | Time-sliced: use problems **≥ 2025-06** only | filter to post-cutoff subset |
| **SWE-bench Verified / Multilingual / Multimodal** | 2023–24 | **contaminated** — treat as floor, not frontier |
| **BugsJS / Defects4J / BugsInPy / QuixBugs / ManyBugs / IntroClass / EvalPlus / APPS / CodeContests / HumanEval-TS** | ≤ 2023 | **heavily contaminated** — only useful for porting mechanics, not for ranking methods |

**Strategy:** build the "hardened" slice of the benchmark from (Web-Bench, SWE-bench Live latest, LiveCodeBench ≥ Jun 2025 filter, SEC-Bench, SWE-Lancer Diamond). Keep the older benches as a "sanity floor".

---

## Sources (live-verified 2026-04-06)

- SWE-bench: https://github.com/SWE-bench/SWE-bench — https://www.swebench.com/
- SWE-bench Multilingual: https://www.swebench.com/multilingual.html
- SWE-bench Multimodal: https://www.swebench.com/multimodal.html
- SWE-bench Live: https://github.com/microsoft/SWE-bench-Live
- Multi-SWE-bench: https://github.com/multi-swe-bench/multi-swe-bench — https://arxiv.org/abs/2504.02605 — HF `ByteDance-Seed/Multi-SWE-bench`
- SWE-PolyBench: https://github.com/amazon-science/SWE-PolyBench — https://arxiv.org/abs/2504.08703 — HF `AmazonScience/SWE-PolyBench`
- SWE-Lancer: https://github.com/openai/SWELancer-Benchmark — https://arxiv.org/abs/2502.12115
- SWE-Gym: https://github.com/SWE-Gym/SWE-Gym — https://arxiv.org/abs/2412.21139
- R2E-Gym: https://github.com/R2E-Gym/R2E-Gym — https://r2e-gym.github.io/
- SWE-smith: https://github.com/SWE-bench/SWE-smith
- BugsJS: https://github.com/BugsJS/bug-dataset — https://bugsjs.github.io/ — STVR paper https://onlinelibrary.wiley.com/doi/full/10.1002/stvr.1751
- Defects4J: https://github.com/rjust/defects4j
- BugsInPy: https://github.com/soarsmu/BugsInPy
- QuixBugs: https://github.com/jkoppel/QuixBugs
- ManyBugs/IntroClass: https://repairbenchmarks.cs.umass.edu/ — https://github.com/ProgramRepair/IntroClass
- APPS: https://github.com/hendrycks/apps
- CodeContests: https://github.com/google-deepmind/code_contests
- BigCodeBench: https://github.com/bigcode-project/bigcodebench — https://bigcode-bench.github.io/
- LiveCodeBench: https://github.com/LiveCodeBench/LiveCodeBench — https://arxiv.org/abs/2403.07974 — https://livecodebench.github.io/
- EvalPlus: https://github.com/evalplus/evalplus
- ClassEval: https://github.com/FudanSELab/ClassEval
- CoderEval: https://github.com/CoderEval/CoderEval
- MultiPL-E: https://github.com/nuprl/MultiPL-E
- Aider Polyglot: https://github.com/Aider-AI/aider (polyglot = Exercism subset)
- ts-bench: https://github.com/laiso/ts-bench
- Web-Bench: https://github.com/bytedance/web-bench — https://arxiv.org/abs/2505.07473
- RepoBench: https://github.com/Leolty/repobench — https://arxiv.org/abs/2306.03091
- CrossCodeEval: https://github.com/amazon-science/cceval — https://crosscodeeval.github.io/
- Long Code Arena: https://github.com/JetBrains-Research/lca-baselines — https://arxiv.org/abs/2406.11612
- LongCodeBench: https://github.com/Zteefano/long-code-bench — https://arxiv.org/abs/2505.07897
- CWEval-bench: https://arise-lab.github.io/cweval-bench/
- CVE-Bench: https://aclanthology.org/2025.naacl-long.212/
- SEC-Bench: https://arxiv.org/abs/2506.11791
- cwe-bench-java: https://github.com/iris-sast/cwe-bench-java
- DebugBench: https://aclanthology.org/2024.findings-acl.247/
