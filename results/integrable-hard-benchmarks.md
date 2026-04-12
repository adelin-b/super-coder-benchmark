# Integrable Hard Benchmarks for Super-Coder Benchmark

Research date: 2026-04-12

Our custom benchmark is too easy (Sonnet scores 97-100%). This document catalogs real benchmarks where frontier models genuinely fail, with actionable details for extracting and converting tasks to our vitest format.

---

## Summary: Priority Rankings

| Benchmark | Best SOTA | JS/TS Native? | Conversion Effort | Priority |
|-----------|-----------|---------------|-------------------|----------|
| **Web-Bench** | 25.1% | YES (JS/TS/HTML/CSS) | Low | **#1 - START HERE** |
| **FeatureBench** | 12.5% resolved | No (Python repos) | High | #2 - Hardest known |
| **SWE-bench Pro** | 23.3% | No (Python repos) | High | #3 - Long-horizon |
| **Aider Polyglot** | 88% (but JS subset ~60%) | Partial (49 JS tasks) | Low-Medium | **#4 - JS tasks extractable** |
| **LiveCodeBench** | ~60% overall, hard tier ~5% | No (Python I/O) | Medium | #5 - Competitive prog |
| **CRUXEval** | ~70% (GPT-4) | No (Python) | Medium | #6 - Code reasoning |
| **CodeContests** | ~5% (AlphaCode) | No (C++/Python) | Medium-High | #7 - Hardest algo |
| **DevBench** | N/A (limited) | No | High | #8 - Skip |

---

## 1. Web-Bench (ByteDance) -- HIGHEST PRIORITY

**Repo:** https://github.com/bytedance/web-bench
**Paper:** https://arxiv.org/abs/2505.07473
**Dataset:** https://huggingface.co/datasets/bytedance-research/Web-Bench
**Leaderboard:** https://huggingface.co/spaces/bytedance-research/Web-Bench-Leaderboard

### What It Is
50 web development projects, each with 20 sequentially dependent tasks (1000 total tasks). Designed by engineers with 5-10 years of experience. Each project takes a senior engineer 4-8 hours to complete.

### Best Model Scores
- Claude 3.7 Sonnet: **25.1%** Pass@1 (best SOTA)
- HumanEval/MBPP are saturated; Web-Bench is harder than SWE-bench Full

### Task Format
Each project has:
- `tasks.jsonl` -- 20 task descriptions in sequential order
- `test/task-N.spec.js` -- Playwright test for each task
- `src-init/` -- initial source code (starting point)
- `src/` -- gold solution source code
- `vite.config.ts`, `playwright.config.js`, `package.json`

Tasks are evaluated with Playwright E2E tests. The agent gets task N's description, must edit code, then tests run via `npm test -- N`.

### Example Tasks (React project)

**Task 11 (challenging):**
> "Add a button with the text 'Random Blogs' in Header to append 100,000 blogs to BlogList at one time. Each blog should have a title formatted in regex 'RandomBlog-[\d]{12}'. Ensure the page will not be stuck when 100000 blogs are appended. Constraint: DO NOT USE any third-party packages, ONLY React APIs can be used to optimize performance."

**Task 14 (challenging):**
> "Enable Markdown text input for blog details. Preview the Markdown in Blog.tsx. Develop a hook or utility to reuse Markdown-related logic. Prevent XSS attacks. Constraint: DO NOT use any third-party packages; ONLY React APIs are permitted."

**Task 19 (Three.js project, challenging):**
> "When the snake passes through the portal, set all snake's objects color to the current color of the portal." (Part of a full 3D snake game built incrementally)

### Why Models Fail
1. **Sequential dependencies** -- task 15 depends on all previous 14 tasks being correct
2. **No third-party packages** constraint forces from-scratch implementations
3. **Complex multi-file architecture** (React Context, custom hooks, routing, state management)
4. **Performance requirements** (100K items without page freeze)
5. **DOM/browser-specific knowledge** (drag-and-drop, resize, canvas, Three.js)

### Conversion to Vitest
**LOW EFFORT.** Already in JS/TS with Playwright tests. Options:
1. Use Playwright tests directly (most faithful)
2. Extract the task descriptions and write vitest equivalents for unit-testable parts
3. The 50 projects span: `react`, `vue`, `svelte`, `angular`, `nextjs`, `nuxt`, `threejs`, `canvas`, `dom`, `expressjs`, `fastify`, `prisma`, `sequelize`, `webpack`, `vite`, `tailwind`, `redux`, `mobx`, `zustand`, `jotai`, `typescript`, `svg`, and more

### How to Extract
```bash
git clone https://github.com/bytedance/web-bench.git
# Each project is in projects/<name>/
# Tasks: projects/<name>/tasks.jsonl
# Tests: projects/<name>/test/task-N.spec.js
# Starting code: projects/<name>/src-init/
```

---

## 2. FeatureBench (LiberCoders) -- HARDEST KNOWN BENCHMARK

**Repo:** https://github.com/LiberCoders/FeatureBench
**Paper:** https://arxiv.org/abs/2602.10975 (ICLR 2026)
**Dataset:** https://huggingface.co/datasets/LiberCoders/FeatureBench
**Leaderboard:** https://LiberCoders.github.io/FeatureBench/

### What It Is
200 feature development tasks from 24 real repositories. Unlike SWE-bench (bug fixing), FeatureBench requires implementing NEW features -- adding functionality, not patching bugs.

### Best Model Scores (Full split, 200 tasks)
| Agent Framework | Model | %Resolved |
|----------------|-------|-----------|
| Codex | GPT-5.1-Codex | **12.5%** |
| Claude Code | Claude Opus 4.5 | **11.0%** |
| OpenHands | Claude Opus 4.5 | **10.5%** |
| Gemini-CLI | Gemini-3-Pro | **5.0%** |
| OpenHands | DeepSeek-V3.2 | **5.5%** |
| OpenHands | Qwen3-Coder-480B | **3.5%** |

For comparison: Claude Opus 4.5 scores 74.4% on SWE-bench Verified but only 11.0% on FeatureBench.

### Task Format
Each task is a HuggingFace dataset entry containing:
- Problem statement (synthesized with explicit interfaces and import paths)
- Repository + commit to start from
- Docker environment for reproducible evaluation
- Fail-to-pass tests (the feature tests)
- Pass-to-pass tests (regression tests)

### Why Models Fail
1. **Feature development, not bug fixing** -- requires understanding architecture to add new capabilities
2. **Dependency graph complexity** -- features touch multiple modules with traced dependencies
3. **Large codebases** -- 24 real repositories with production-scale code
4. **Ambiguous specifications** -- synthesized problem statements require architectural reasoning

### Conversion to Vitest
**HIGH EFFORT.** Tasks are Python-centric (real Python repos). Would need to:
1. Download from HuggingFace, extract problem statements
2. Use the problem statement format as inspiration for our own TypeScript feature tasks
3. Cannot directly convert -- repos are Python (Django, Flask, etc.)

### Splits Available
- **Fast split**: 100 instances, no GPU needed, ~57s per instance evaluation
- **Lite split**: 30 instances
- **Full split**: 200 instances

---

## 3. SWE-bench Pro (Scale AI) -- LONG-HORIZON ENGINEERING

**Repo:** https://github.com/scaleapi/SWE-bench_Pro-os
**Paper:** https://scale.com/research/swe_bench_pro
**Dataset:** https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro
**Leaderboard:** https://scale.com/leaderboard/swe_bench_pro_public

### What It Is
A harder variant of SWE-bench designed to address data contamination, limited diversity, oversimplified problems, and irreproducible testing. Tasks from diverse and complex codebases including consumer applications, B2B services, and developer tools.

### Best Model Scores (Public subset)
| Model | SWE-bench Verified | SWE-bench Pro (Public) | SWE-bench Pro (Private) |
|-------|-------------------|----------------------|------------------------|
| GPT-5 | 70%+ | **23.3%** | **14.9%** |
| Claude Opus 4.1 | 70%+ | **23.1%** | **17.8%** |
| GPT-4o | -- | **4.9%** | -- |
| Qwen-3 32B | -- | **3.4%** | -- |

The private subset (unseen codebases) is even harder: best models drop to ~15-18%.

### Task Format
Same as SWE-bench: codebase + issue description -> generate a patch. Each task has:
- Docker environment with all dependencies
- Fail-to-pass tests
- Pass-to-pass regression tests
- Full commit history

### Why Models Fail
1. **Data contamination resistant** -- uses GPL-licensed repos unlikely to be in training data
2. **Consumer/B2B applications** -- not just utility libraries
3. **Long-horizon tasks** -- require understanding large, complex codebases
4. **Ambiguous issues** -- real developer workflow, not sanitized problems

### Conversion to Vitest
**HIGH EFFORT.** Python-centric repos. Best used as a model for task design rather than direct conversion.

---

## 4. Aider Polyglot Benchmark -- EXTRACTABLE JS TASKS

**Repo:** https://github.com/Aider-AI/aider (benchmark/ directory)
**Leaderboard:** https://aider.chat/docs/leaderboards/
**Blog:** https://aider.chat/2024/12/21/polyglot.html

### What It Is
225 challenging Exercism coding exercises across C++, Go, Java, JavaScript, Python, and Rust. Specifically selected as the HARDEST exercises -- only problems solved by 3 or fewer of 7 frontier models.

### Best Model Scores
| Model | Pass Rate |
|-------|-----------|
| GPT-5 (high) | **88.0%** |
| GPT-5 (medium) | **86.7%** |
| o3-pro (high) | **84.9%** |
| Claude Opus 4.5 | ~79% |
| gpt-4o-mini | **3.6%** |
| gemma-3-27b | **4.9%** |

Note: Top models score well overall, but this is averaged across languages. Individual HARD exercises still defeat all models.

### Language Distribution
| Language | Problems |
|----------|----------|
| JavaScript | **49** |
| Java | 47 |
| Go | 39 |
| Python | 34 |
| Rust | 30 |
| C++ | 26 |
| **Total** | **225** |

### Task Format
Each Exercism exercise provides:
- A problem description (markdown)
- A starter file with function/class stubs
- Unit tests (language-specific test framework)
- The model must implement the solution given the description + tests

### Example Exercise Pattern
The model receives existing test files and a stub implementation file. It must write code to pass all tests. Problems include algorithm challenges, data structure implementations, and language-specific idioms.

### Why Models Fail
1. **Hard algorithmic problems** -- filtered for difficulty (unsolvable by most models)
2. **Language-specific idioms** -- must know C++ templates, Rust lifetimes, Go channels, etc.
3. **No external packages** -- pure standard library solutions
4. **66 exercises were unsolvable by ANY of the 7 test models**

### Conversion to Vitest
**LOW-MEDIUM EFFORT for the 49 JavaScript exercises.** Steps:
1. Clone Exercism JavaScript track: https://github.com/exercism/javascript
2. The 49 hardest JS exercises are already in JavaScript with Jest tests
3. Convert Jest -> vitest (usually just changing imports)
4. These are the exercises no model could solve when the benchmark was designed

### How to Extract JavaScript Tasks
```bash
git clone https://github.com/exercism/javascript.git
# Each exercise is in exercises/practice/<name>/
# Has: .meta/config.json, <name>.spec.js, <name>.js (stub)
# The 49 hardest are identified in the aider polyglot benchmark selection
```

---

## 5. LiveCodeBench -- COMPETITIVE PROGRAMMING

**Repo:** https://github.com/LiveCodeBench/LiveCodeBench
**Dataset:** https://huggingface.co/datasets/livecodebench/code_generation_lite
**Leaderboard:** https://livecodebench.github.io/leaderboard.html

### What It Is
Continuously updated competitive programming benchmark. Collects problems from LeetCode, AtCoder, and CodeForces. Currently 1055 problems (release_v6, through April 2025). Designed to be contamination-free since problems are from after training cutoffs.

### Best Model Scores
- Top models: ~60% pass@1 overall
- **Easy**: ~90%+ for top models
- **Medium**: ~50-70%
- **Hard**: ~5-15% for even the best models

The hard tier is where models genuinely fail.

### Task Format
Standard competitive programming: given a problem statement with input/output specification, generate a Python solution. Evaluated with pass@1 and pass@5 metrics.

```json
{"question_id": "id1", "code_list": ["solution_code_1", "solution_code_2"]}
```

Problems come with:
- Natural language problem description
- Input format specification
- Output format specification
- Example input/output pairs
- Hidden test cases for evaluation

### Why Models Fail on Hard Tier
1. **Advanced algorithms** -- segment trees, heavy-light decomposition, convex hull tricks
2. **Mathematical reasoning** -- number theory, combinatorics, modular arithmetic
3. **Edge cases** -- constraints require careful handling of large numbers, overflow
4. **Time complexity** -- brute force solutions TLE; need optimal O(n log n) or better

### Conversion to Vitest
**MEDIUM EFFORT.** Problems are language-agnostic (algorithmic). Steps:
1. Download from HuggingFace
2. Filter for hard problems only
3. Convert Python I/O format to TypeScript function signatures
4. Write vitest tests checking function output against expected results
5. The hard problems (Codeforces 2000+ Elo) are genuinely challenging

---

## 6. CRUXEval (Facebook Research) -- CODE REASONING

**Repo:** https://github.com/facebookresearch/cruxeval
**Dataset:** https://huggingface.co/datasets/cruxeval-org/cruxeval
**Leaderboard:** https://crux-eval.github.io/leaderboard.html

### What It Is
800 Python functions with input-output pairs. Two tasks:
- **CRUXEval-I** (Input prediction): Given function + output, predict the input
- **CRUXEval-O** (Output prediction): Given function + input, predict the output

Tests code REASONING and UNDERSTANDING, not generation.

### Best Model Scores
- GPT-4: ~70% pass@1
- Code Llama 34B: ~50%
- Smaller models: 20-40%

### Task Format (Actual Examples from Dataset)
```json
{
  "code": "def f(nums):\n    output = []\n    for n in nums:\n        output.append((nums.count(n), n))\n    output.sort(reverse=True)\n    return output",
  "input": "[1, 1, 3, 1, 3, 1]",
  "output": "[(4, 1), (4, 1), (4, 1), (4, 1), (2, 3), (2, 3)]"
}
```

```json
{
  "code": "def f(dic):\n    for k,v in sorted(dic.items(), key=lambda x: len(str(x)))[:-1]:\n        dic.pop(k)\n    return list(dic.items())",
  "input": "{'11': 52, '65': 34, 'a': 12, '4': 52, '74': 31}",
  "output": "[('74', 31)]"
}
```

### Why Models Fail
1. **Requires mental execution** -- not pattern matching, actual step-by-step reasoning
2. **Tricky Python semantics** -- `.count()` in loops, dictionary mutation during iteration, `.sort()` stability
3. **Input prediction is inverse reasoning** -- must work backwards from output to input
4. **Edge cases** -- empty strings, special characters, type coercions

### Conversion to Vitest
**MEDIUM EFFORT.** Convert Python functions to TypeScript equivalents, test input/output prediction:
```typescript
// vitest test
test('CRUXEval-O: predict output', () => {
  // Given this function and input, the model must predict the output
  const f = (nums: number[]) => {
    const output: [number, number][] = [];
    for (const n of nums) {
      output.push([nums.filter(x => x === n).length, n]);
    }
    output.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    return output;
  };
  expect(f([1, 1, 3, 1, 3, 1])).toEqual([[4, 1], [4, 1], [4, 1], [4, 1], [2, 3], [2, 3]]);
});
```

---

## 7. CodeContests (Google DeepMind) -- HARDEST ALGORITHMIC

**Repo:** https://github.com/google-deepmind/code_contests
**Paper:** https://www.science.org/doi/10.1126/science.abq1158 (AlphaCode, Science 2022)

### What It Is
Competitive programming dataset used to train AlphaCode. Problems from Codeforces, AtCoder, CodeChef, HackerEarth, and Aizu. Includes correct AND incorrect human solutions.

### Scores
AlphaCode achieved average top 54.3% ranking on Codeforces (roughly 1200-1400 Elo). Problems rated 2000+ Elo are essentially unsolvable by current AI.

### Task Format
Protocol buffer format (Riegeli). Each problem contains:
- Problem description (natural language)
- Input/output specification
- Multiple test cases (public and private)
- Correct and incorrect solutions in multiple languages
- Difficulty rating from source platform

### Data Access
```bash
# ~3GB download
gsutil -m cp -r gs://dm-code_contests /tmp
# Format: ContestProblem protocol buffers in Riegeli format
# Splits: train (~13K), validation, test
```

### Why Models Fail
1. **Competition-level difficulty** -- Codeforces Div 1 problems (1800+ Elo)
2. **Complex algorithmic thinking** -- dynamic programming on trees, network flow, computational geometry
3. **Mathematical proofs** -- need to derive formulas, not just implement
4. **Tight time/memory constraints** -- require asymptotically optimal solutions

### Conversion to Vitest
**MEDIUM-HIGH EFFORT.** Algorithmic problems are language-agnostic:
1. Extract problems from protocol buffers using provided Python script
2. Convert I/O problems to TypeScript function problems
3. Write vitest tests with input/output pairs
4. Filter for hardest problems (Codeforces rating 1800+)

---

## 8. DevBench

**Repo:** https://github.com/wxm201411/DevBench
**Note:** This is a Chinese research project comparing LLMs across development aspects (requirements, frontend, backend, bug fixing, full project). Limited TypeScript-specific content.

### Assessment
Not highly useful for our purposes. The benchmark is more about holistic development evaluation than providing individual hard tasks. The methodology is interesting but tasks are not easily extractable. **SKIP.**

---

## Integration Strategy

### Phase 1: Quick Wins (1-2 days)

1. **Web-Bench** -- Clone the repo, extract the 50 projects. Each has 20 Playwright-tested tasks already in JS/TS. Focus on the "challenging" tasks (roughly tasks 11-20 in each project). That gives us ~500 hard tasks natively in our stack.

2. **Aider Polyglot JS subset** -- Extract the 49 JavaScript Exercism exercises that were selected as hardest. Convert Jest tests to vitest. Instant 49 hard tasks.

### Phase 2: Algorithmic Hard Tasks (1 week)

3. **LiveCodeBench Hard tier** -- Download from HuggingFace, filter for hard problems, convert ~100 to TypeScript + vitest format.

4. **CRUXEval** -- Convert 200 hardest Python reasoning tasks to TypeScript equivalents. Tests code understanding, not generation.

### Phase 3: Feature Development (2 weeks)

5. **FeatureBench-inspired tasks** -- Study the 200 task problem statements, create TypeScript equivalents targeting real feature development in TS repos.

6. **SWE-bench Pro patterns** -- Study unsolved tasks, design equivalent TypeScript challenges.

### Estimated Task Yield

| Source | Tasks | Native JS/TS? | Difficulty |
|--------|-------|---------------|------------|
| Web-Bench (challenging tasks) | ~500 | Yes | Very Hard (SOTA 25%) |
| Web-Bench (all tasks) | 1000 | Yes | Mixed |
| Aider JS exercises | 49 | Yes (Jest->vitest) | Hard |
| LiveCodeBench hard | ~100 | Convert from Python | Very Hard |
| CRUXEval | ~200 | Convert from Python | Hard (reasoning) |
| FeatureBench-inspired | ~50 | Create new | Extreme |
| **Total available** | **~900** | | |

---

## Key Insight: Why These Benchmarks Are Hard

Our custom benchmark fails because we write the spec AND the test, creating tasks that are solvable by definition. Real benchmarks are hard because:

1. **Sequential dependencies** (Web-Bench) -- one failure cascades
2. **Real codebase context** (FeatureBench, SWE-bench Pro) -- must understand existing architecture
3. **No third-party packages** (Web-Bench) -- can't use shortcuts
4. **Inverse reasoning** (CRUXEval) -- predicting inputs from outputs
5. **Algorithmic optimality** (LiveCodeBench, CodeContests) -- brute force fails
6. **Contamination resistance** (LiveCodeBench, SWE-bench Pro) -- fresh problems

**The #1 actionable recommendation: Start with Web-Bench.** It is already JS/TS, has 1000 Playwright-tested tasks, SOTA is 25%, and it covers the exact web development skills we want to test.
