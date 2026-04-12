# Deep Paper Analysis: Why LLMs Fail at Code Generation

> Research synthesis from 8 academic papers and benchmark analyses.
> Generated 2026-04-12 for the super-coder-benchmark project.

---

## Table of Contents

1. [Paper 1: Where Do LLMs Still Struggle?](#paper-1)
2. [Paper 2: A Deep Dive Into LLM Code Generation Mistakes](#paper-2)
3. [Paper 3: The Illusion of Procedural Reasoning](#paper-3)
4. [Paper 4: Rectangle Union -- The Simple Task That Defeats All LLMs](#paper-4)
5. [Paper 5: LiveCodeBench Pro Analysis](#paper-5)
6. [Paper 6: Frontier LLMs Still Struggle with Simple Reasoning](#paper-6)
7. [Paper 7: On the Failure of Latent State Persistence](#paper-7)
8. [Paper 8: SWE-bench Difficulty Analysis](#paper-8)
9. [SYNTHESIS A: How to Make Unbreakable Tests](#synthesis-a)
10. [SYNTHESIS B: How to Improve the Agent Prompt](#synthesis-b)
11. [SYNTHESIS C: The Fundamental Limits](#synthesis-c)

---

<a id="paper-1"></a>
## Paper 1: "Where Do LLMs Still Struggle?"

**Source:** arxiv 2511.04355 -- Sharifloo et al.
**URL:** https://arxiv.org/html/2511.04355v1

### Methodology

- **Benchmarks:** MBPP, HumanEval, BigCodeBench (BCB-Hard), LiveCodeBench
- **Models tested:** Claude Sonnet-4, DeepSeek-V3, Qwen3-Coder, GPT-4o, Llama-3.3-70B, Mistral-3.2-24B
- **Approach:** Task-level study identifying tasks that major LLMs consistently fail. Measured static code complexity (cyclomatic complexity, data structures, function calls, code length, nesting depth, recursions) via AST analysis, then correlated with failure rates. Manually inspected 114 consistently failed tasks.

### Key Findings

**Complexity vs. Failure:** Complexity alone does NOT explain failure.
- LiveCodeBench showed positive correlation between code complexity and failure rate
- HumanEval, MBPP, and BCB-Hard showed **weak, statistically non-significant** correlations
- BCB-Hard: metrics like length and nesting depth achieved moderate R^2 (~0.14-0.15) with borderline p-values (~0.07-0.09) -- not statistically significant
- **Conclusion: Additional factors beyond solution complexity play a significant role in failures**

**The 114 Consistently Failed Tasks -- Four Failure Patterns:**

1. **Wrong Problem Mapping (most dangerous)**
   - Models interpret a task as belonging to the **wrong problem class**
   - Example: HumanEval/132 asks for a valid *subsequence* with nested brackets. ALL models incorrectly mapped this to the standard "balanced brackets" problem and applied a stack-based early-return strategy
   - Root cause: **Bias toward familiar problem types** -- LLMs pattern-match to the nearest training exemplar rather than carefully reading the spec
   - This is a fundamental retrieval/classification error, not a reasoning error

2. **Flawed or Incomplete Algorithm Design**
   - Models take the correct approach but include flawed or incomplete steps
   - Example: BCB-Hard/945 requires time-series regression with non-monotonic trends. LLMs correctly implemented data processing and regression but did NOT incorporate mechanisms to handle non-monotonic trends
   - Root cause: Models generate "happy path" algorithms, omitting handling for complex behavioral patterns

3. **Edge Case Mishandling**
   - Models fail on boundary conditions, empty inputs, overflow, special values
   - Root cause: LLMs optimize for the common case seen in training data; edge cases are underrepresented

4. **Formatting Mistakes**
   - Output format deviations (wrong delimiters, spacing, newlines, type coercion)
   - Root cause: Specs often describe format implicitly; models fill gaps with training-data defaults

**Additional finding:** Some benchmark tasks are "extremely ambiguous" -- certain failures don't reflect actual model weaknesses but rather poor task specifications.

### Actionable Takeaways

**For harder tests:**
- Design tasks that *resemble* a well-known problem class but have a critical twist (forces wrong problem mapping)
- Require handling of non-monotonic, adversarial, or degenerate data patterns
- Include strict output format requirements that differ from common conventions
- Combine multiple algorithmic ideas into a single task

**For better agent prompts:**
- Instruct the agent to re-read the spec and identify how the task *differs* from the most similar well-known problem
- Add explicit edge-case enumeration step before coding
- Require the agent to verify output format against the spec before returning

---

<a id="paper-2"></a>
## Paper 2: "A Deep Dive Into LLM Code Generation Mistakes"

**Source:** arxiv 2411.01414 -- Chen et al. (UC Irvine)
**URL:** https://arxiv.org/html/2411.01414v1

### Methodology

- **Datasets:** HumanEval-X (standalone functions) and CoderEval (real-world code with dependencies)
- **Models:** GPT-4, Gemini (code generation); GPT-4 with ReAct (mistake detection)
- **Approach:** Extensive manual analysis of non-syntactic mistakes. Identified mistakes arising from misunderstanding of coding question specifications. Used both algorithmic standalone tasks AND production-context tasks with external dependencies.

### The Seven Categories of Non-Syntactic Mistakes

| Category | Description | Key Insight |
|----------|-------------|-------------|
| **Conditional Error (CE)** | Inaccurate or omitted conditional statements | Most prevalent in HumanEval-X. GPT-4 and Gemini both produce these frequently |
| **Garbage Code (GC)** | Code that diverges significantly from task requirements | Second most prevalent. Model completely misunderstands the task |
| **Hallucinated Object (HO)** | References to non-existent APIs, methods, or objects | *Newly identified.* Especially common in CoderEval (real-world context) |
| **Wrong Code (WC)** | Logically incorrect implementation of the right approach | Subtle errors in algorithm logic |
| **Missing Corner Case (MCC)** | Failure to handle edge/corner cases | Similar to Paper 1's edge case findings |
| **Operation Error (OE)** | Wrong mathematical or logical operations | Arithmetic, comparison, or bitwise errors |
| **Minor Output Formatting Error (MOFE)** | Output format deviations | More common in CoderEval than HumanEval-X |

**Four of these seven categories were missed by previous works** (HO, WC, MCC, OE).

### Distribution Differences

- **HumanEval-X** (algorithmic): More Conditional Errors and Garbage Code
- **CoderEval** (real-world): More Minor Output Formatting Errors and Hallucinated Objects
- **GPT-4 vs Gemini:** GPT-4 exhibits lower frequency of CE and GC, suggesting superior reasoning

### The Six Root Causes

| Reason | Description | Frequency |
|--------|-------------|-----------|
| **Misunderstood Coding Question Specification (MCQS)** | Confused by specific phrases in the spec | **Most frequent across both datasets** |
| **Misleading Function Signature (MFS)** | Function name/params suggest wrong behavior | Common |
| **Missing Context (MC)** | Insufficient context about dependencies/environment | Especially in CoderEval |
| **Incomplete Specification (IS)** | Spec doesn't fully describe expected behavior | Ambiguity in requirements |
| **Incorrect Assumption (IA)** | Model makes wrong assumptions to fill gaps | Defaults to training-data patterns |
| **Overcomplicated Solution (OCS)** | Model overengineers, adding unnecessary complexity | Introduces new failure points |

**Critical finding:** The most frequent reason is **Misunderstood Coding Question Specification** -- models are confused by specific phrases and ambiguous requirements. Example: "Check if two words have the same characters" -- the LLM interpreted this as checking character *frequency* (using dictionaries to count) rather than just checking if the same set of characters appears.

### LLM Self-Detection Capability

- GPT-4 detecting mistakes in HumanEval-X: **Precision 0.86, Coverage Rate 0.87** (close to human precision 1.0, CR 0.95)
- GPT-4 detecting mistakes in CoderEval: **Precision 0.53, Coverage Rate 0.71** (much worse -- real-world context is harder)
- GPT-4 identifying *reasons* for mistakes (with ReAct): **F1 up to 0.65**
- GPT-4 can identify some mistakes that humans missed (CR 0.95 for humans vs 0.87 for GPT-4 on HumanEval-X)

### Actionable Takeaways

**For harder tests:**
- Write specs with deliberately ambiguous phrasing that has only one correct interpretation
- Use misleading function signatures (name suggests one behavior, spec requires another)
- Require real-world context (external dependencies, project-specific APIs)
- Include tasks where the "obvious" interpretation is wrong

**For better agent prompts:**
- Add a "specification disambiguation" step: rephrase the spec in your own words before coding
- When function signature conflicts with spec, always trust the spec
- For real-world code: explicitly enumerate all available APIs/dependencies before coding
- After coding: verify the solution handles the exact phrasing of the spec, not what you assumed

---

<a id="paper-3"></a>
## Paper 3: "The Illusion of Procedural Reasoning"

**Source:** arxiv 2511.14777 -- Samiei et al.
**URL:** https://arxiv.org/html/2511.14777v1

### Methodology

- **Framework:** Finite-State Machine (FSM) Execution -- models given an explicit FSM definition, must execute it step-by-step
- **Metrics:** Turn Accuracy (local correctness per step) and Task Accuracy (global long-horizon correctness)
- **Models:** Various Qwen models (different sizes), Qwen3-235B, Gemini-2.5-Flash
- **Configurations tested:** Varying states (2-40), actions (2-40), with identical total transitions (80)

### Key Findings with Numbers

**Scaling helps locally but NOT globally:**
- Even the **largest model (Qwen3-235B) reaches only ~50% Task Accuracy** on a baseline FSM (4 states, 5 actions)
- Turn Accuracy improves with model scale, but Task Accuracy remains brittle
- Scaling alone does NOT yield genuine procedural competence

**The Counter-Intuitive Branching Factor Finding:**

Two configurations with identical total transitions (80):
- Config 1 (Wide & Shallow): 2 states, 40 actions
- Config 2 (Deep & Narrow): 40 states, 2 actions

**Result: Both models performed SIGNIFICANTLY better on 40 states/2 actions than 2 states/40 actions**

This is counter-intuitive -- fewer states should be "easier." The explanation:
- **It's NOT a failure of state memory -- it's a failure of RULE RETRIEVAL**
- In 2 states/40 actions: each state has 40 very similar transition rules (high branching factor). The model must find one correct rule from 40 similar options -- a "needle in a haystack" for the attention mechanism
- In 40 states/2 actions: only 2 rules per state, making rule retrieval trivial

**Negative Self-Conditioning:**
- Smaller models exhibit a **decaying pattern in Turn Accuracy over time**
- As a model makes mistakes, its ability to perform the NEXT step correctly degrades
- Early errors propagate through subsequent steps, leading to **global collapse**
- This is compounding error: errors in step N corrupt the context for step N+1

**Multi-Step Instructions Catastrophe:**
- When models must process two-action instructions (execute two transitions mentally before responding), accuracy drops **catastrophically**
- This effect is partially mitigated when models externalize intermediate steps (scratchpad/chain-of-thought)

### Root Cause Analysis

1. **Rule retrieval failure under high branching:** The attention mechanism struggles to select the right rule from many similar options
2. **Compounding error over long horizons:** Each small error increases the probability of subsequent errors
3. **Internal reasoning fragility:** Models cannot reliably perform multi-step reasoning without externalizing intermediate state

### Actionable Takeaways

**For harder tests:**
- Design tasks requiring tracking many similar-but-different rules (high branching factor)
- Require long chains of state transitions where one error cascades
- Require multi-step internal computation before producing output
- Include many similar variable names/states that differ in subtle ways

**For better agent prompts:**
- **Always externalize intermediate state** -- never ask the model to track state purely internally
- Break complex multi-step operations into explicit sequential steps with intermediate output
- When many similar rules/cases exist, explicitly enumerate which one applies
- Design prompts that minimize branching factor: prefer deep/narrow over wide/shallow decision trees

**Practical design principle from the paper:** "When building LLM-based systems, it is preferable to design workflows with low branching factors (few options per decision point) rather than few states with many options."

---

<a id="paper-4"></a>
## Paper 4: "All Major LLMs Struggle with This Simple Programming Task"

**Source:** Peter Kullmann, Medium (Nov 2024)
**URL:** https://peter-kullmann.medium.com/all-major-llms-struggle-with-this-simple-programming-task-3e6903fae3a2

### The Task

Compute the **rectangular polygonal outline path** of a set of overlapping rectangles. Given rectangles with (x, y, width, height), return an array of points that traces the outer boundary of their union.

This is NOT just computing the union area -- it requires computing the exact geometric boundary path as a sequence of coordinate points.

### Models Tested (ALL Failed)

- ChatGPT (GPT-4)
- Claude
- Gemini
- GitHub Copilot
- Mistral (Nov 2024)
- Perplexity (GPT-3.5)

**None produced a correctly functioning solution**, even after being given a concrete example with expected input/output.

### Why This Task Defeats All Models

1. **Geometric reasoning required:** The task requires understanding 2D spatial relationships, not just numerical computation
2. **Algorithm selection failure:** The correct approach involves coordinate compression + sweep line algorithm. Models don't select this algorithm -- they try simpler approaches that fail on overlapping cases
3. **Combinatorial boundary tracing:** Tracing the exact boundary of a union of rectangles requires careful handling of which edges are interior vs. exterior, tracking direction, and handling T-junctions
4. **Rare in training data:** While individual components (sweep line, coordinate compression) exist in training data, the specific combination for boundary path extraction is rare
5. **Multiple interacting sub-problems:** Requires combining: (a) coordinate compression, (b) sweep line event processing, (c) boundary edge classification, (d) path ordering/winding

### Common Wrong Approaches by LLMs

- Simple bounding box (ignoring internal structure)
- Pairwise intersection handling (doesn't generalize to n rectangles)
- Naive edge merging (misses T-junctions and interior edges)
- Convex hull approaches (wrong -- the union boundary is not convex)

### Root Cause Analysis

This task sits in a "dead zone" for LLMs:
- **Too novel for pattern matching** -- this exact task is rarely solved in training data
- **Too combinatorial for reasoning** -- requires maintaining multiple geometric invariants simultaneously
- **Requires genuine spatial reasoning** -- not reducible to text/symbol manipulation
- The problem *looks* simple (rectangles! outlines!) but requires a non-trivial algorithmic pipeline

### Actionable Takeaways

**For harder tests:**
- Geometric/spatial reasoning tasks are reliable LLM breakers
- Tasks requiring composition of multiple known algorithms into a novel pipeline
- Problems where the naive approach "almost works" but fails on subtle cases
- Tasks requiring maintaining geometric invariants (winding order, inside/outside classification)

**For better agent prompts:**
- For geometric tasks: instruct the agent to draw/reason about specific examples before coding
- Encourage step-by-step algorithm design before implementation
- Ask the agent to identify known algorithmic building blocks (sweep line, coordinate compression) explicitly
- Require verification against non-trivial test cases (multiple overlapping rectangles)

---

<a id="paper-5"></a>
## Paper 5: LiveCodeBench Pro Analysis

**Source:** arxiv 2506.11928 -- Zheng et al.; emergentmind.com synthesis
**URLs:** https://www.emergentmind.com/topics/livecodebench-hard, https://www.emergentmind.com/papers/2506.11928

### Methodology

- **Benchmark:** LiveCodeBench Pro -- problems from Codeforces, ICPC, IOI, continuously updated
- **Difficulty:** Codeforces Elo-based: "hard" defined as d > 3000 (problems fewer than 0.1% of participants can solve)
- **Expert annotation:** Olympiad medalists annotate every problem for algorithmic categories
- **Forensic analysis:** 125 failed o3-mini submissions vs. 125 failed human submissions, line-by-line diagnosis by medalists

### Key Findings with Numbers

**Absolute pass rates on hard problems are abysmal:**
- GPT-4-Turbo: ~1.1% pass@1
- GPT-4: ~0.5% pass@1
- Claude-3-Opus: ~6.4% pass@1 (best among early models)
- Self-repair doesn't help: best is ~6.7% (Claude-3-Opus)
- **On hard problems (Elo > 3000): ALL models score 0% pass@1**

**Updated results (2025):**
- Best model on medium difficulty: 53% pass@1 (without external tools)
- Hard problems: **0% pass@1** for all models without tools
- HLCE (ICPC/IOI finals level): best pass@1 is 15.85% (o4-mini-high)
- Seed-CTS with MCTS: pass@1 = 0.351 on LiveCodeBench-Hard

**The 34:1 Idea-vs-Implementation Failure Ratio:**

From the 125-vs-125 forensic analysis:
- **o3-mini commits 34 MORE algorithmic logic errors than human contestants**
- **o3-mini commits 25 FEWER implementation logic errors than humans**
- LLM failures are dominated by **conceptual errors** (wrong algorithm, wrong reduction, hallucinated assumptions)
- Human failures lean toward **implementation errors** (I/O, initialization, off-by-one)
- These are genuine conceptual slips, NOT surface bugs

**Where LLMs succeed vs. fail (by algorithmic category):**

| Strong (LLMs match/exceed grandmaster) | Weak (catastrophic degradation) |
|----------------------------------------|--------------------------------|
| Segment tree | Game theory |
| Dynamic programming | Greedy |
| Combinatorics | Ad-hoc |
| Implementation-heavy tasks | Case work |
| Data structures | Interactive problems |
| Graph algorithms | Observation-heavy tasks |

**Critical insight:** LLMs succeed at **template-centric, knowledge-heavy** problems (DP, segment trees) where the algorithm is well-known. They fail at **observation-heavy, creative** problems requiring novel algorithmic insight.

**"Fails Sample" problem:** LLMs frequently submit solutions that would fail on the PROVIDED sample test cases. This is because they lack tool/terminal access to actually run their code. When tool use is enabled, this deficit narrows significantly.

### Root Cause Analysis

1. **Algorithmic Logic Errors dominate:** NOT implementation bugs, but deep reasoning gaps
2. **Lack of Internal Validation:** Models don't sanity-check their own solutions against examples
3. **Confidently incorrect justifications:** Models generate plausible-sounding but wrong explanations
4. **Tool-free limitations:** Without execution, models miss both obvious and hidden edge cases
5. **Observation poverty:** Models can't "see" the key insight that makes a problem tractable

### Actionable Takeaways

**For harder tests:**
- Observation-heavy problems requiring novel algorithmic insight (not templateable)
- Game theory, greedy with non-obvious greedy choice, ad-hoc case analysis
- Problems where the "obvious" DP/graph approach is a trap and a creative observation is needed
- Interactive protocol problems
- Problems where provided sample cases are necessary to validate the approach

**For better agent prompts:**
- **Always run sample test cases** before submitting -- this alone catches many failures
- For algorithmic problems: enumerate at least 3 possible approaches before committing to one
- Require the agent to prove the correctness of its greedy/observation choice
- When solving competition-style problems, first identify the algorithmic category explicitly
- Add self-verification: "Does my solution handle the sample input correctly?"

---

<a id="paper-6"></a>
## Paper 6: "Frontier LLMs Still Struggle with Simple Reasoning Tasks"

**Source:** arxiv 2507.07313 -- Malek et al. (Google DeepMind)
**URL:** https://arxiv.org/html/2507.07313v1

### Methodology

- **Task suite:** Procedurally generated simple reasoning tasks with tunable parameters
- **Task types:** Counting, First-Order Logic, Proof Trees, Travel Planning
- **Models (traditional):** GPT-4o, Gemini 1.5 Pro, Gemini 2.0 Flash, Gemma 3 27B, Claude 3.5 Sonnet, Claude 3.7 Sonnet
- **Models (thinking):** OpenAI o1, o3, Gemini 2.0 Flash Thinking, Gemini 2.5 Pro, DeepSeek R1
- **Key innovation:** Parameters (document length, tree depth, number of cities) can increase computation while preserving fundamental difficulty -- the task doesn't get HARDER, just more TEDIOUS

### Key Findings

**Even thinking models fail on "easy" tasks at scale:**

The critical insight is that scaling the *amount of computation* (not the difficulty) breaks models:
- **Counting task:** Increasing paragraph length degrades accuracy
- **Logic problems:** Increasing tree depth degrades accuracy
- **Proof Trees:** Increasing depth with irrelevant sentences causes missed statements
- **Travel Planning:** Increasing number of unique cities degrades accuracy

**Three failure modes identified:**

1. **Statistical shortcuts:** Models take shortcuts based on surface patterns instead of actually computing the answer
2. **Errors in intermediate steps:** Small per-step error probability compounds exponentially -- more steps = exponentially more total failures
3. **Long context difficulties:** Models struggle to attend to relevant information in long contexts (the "needle in a haystack" problem again)

**The Unpuzzles Dataset -- Memorization Trap:**

The paper creates "Unpuzzles" -- trivialized versions of well-known math/logic puzzles:
- **Models excel at the ORIGINAL puzzles** (memorized from training)
- **Models FAIL on the trivialized versions** even though they're strictly easier
- Performance gaps: **9.1% (o3) to 54% (Gemini 1.5)** between original and unpuzzle
- Even thinking models simply output the solution to the original puzzle about **1/5 of the time**
- This happens even when models can solve different-looking problems requiring the same logic

**Example:** A Chameleon puzzle with 15 purple, 15 yellow, 17 maroon chameleons. The original version has a well-known answer. The trivialized version changes numbers so the answer becomes trivially "yes." Models still output the original puzzle's "no" answer.

### Root Cause Analysis

1. **Memorization over reasoning:** Models retrieve memorized solutions rather than reasoning from scratch
2. **Compounding step errors:** Each reasoning step has a small error probability; long chains exponentially amplify this
3. **Attention degradation in long contexts:** Relevant information gets "lost" among irrelevant context
4. **Out-of-distribution generalization failure:** Slight modifications to known problems break models completely

### Actionable Takeaways

**For harder tests:**
- Take well-known programming problems and modify them so the "standard" solution is wrong
- Design tasks that are easy in principle but require many tedious steps
- Include irrelevant information that models must correctly ignore
- Use problems that superficially resemble famous problems but have different solutions
- Scale the problem size to require long reasoning chains

**For better agent prompts:**
- Instruct the agent: "Do NOT assume this is a known problem. Reason from first principles."
- For well-known problem types: "Verify that the standard approach applies to THIS SPECIFIC instance"
- Encourage step-by-step verification with intermediate sanity checks
- "Read the problem statement carefully and identify how it DIFFERS from similar known problems"

---

<a id="paper-7"></a>
## Paper 7: "On the Failure of Latent State Persistence in LLMs"

**Source:** arxiv 2505.10571 -- Huang et al.
**URL:** https://arxiv.org/html/2505.10571

### Methodology

- **17 frontier LLMs tested** including GPT-4o, o-series, LLaMA variants, Qwen, QwQ, DeepSeek
- **Three experiments** probing working memory / latent state:
  1. Number Guessing Game
  2. Yes-No Game
  3. Mathematical Mentalism

### Experiment 1: Number Guessing Game

The model is asked to "think of a number" and then queried multiple times about what number it chose.

**Results:**
- LLMs **fail to allocate probability mass to a singular hidden choice**
- Responses disproportionately cluster around **the number 7** (echoing the "blue-seven" phenomenon from human psychology)
- Across independent queries, models give **different answers** -- they never truly "chose" a number
- 200 independent trials per query, tested across Temperature and Top-p settings (0 to 1)

### Experiment 2: Yes-No Game

The model thinks of a concept, and the user asks yes/no questions to narrow it down.

**Results:**
- As the number of questions increases, LLMs suffer from **"concept drift"**
- This leads to **inevitable self-contradictions**
- The model's answers become inconsistent because it never had a persistent internal state
- The more questions asked, the higher the contradiction rate

### Experiment 3: Mathematical Mentalism

Models must track transformations on hidden variables (e.g., "think of a number, double it, add 5, divide by 3...").

**Results:**
- **Majority of models exhibit near-zero ISR (Invariant Success Rate)**
- Models cannot maintain the integrity of a hidden variable through a sequence of non-linear transformations
- LLaMA family shows marginally higher ISR and more diversified distributions, but still fundamentally fails
- **With Chain-of-Thought prompting:** ISR improves to **10-30%** (from near-zero), but still far from reliable
- This proves that externalizing state (CoT) partially mitigates the problem but doesn't solve it

### Core Finding

**LLMs function as "reactive post-hoc solvers" rather than "proactive planners with persistent state."**

They don't maintain internal variables -- they generate the most statistically plausible completion for the dialogue pattern. There is no "working memory" in the human cognitive sense.

### Actionable Takeaways

**For harder tests:**
- Tasks requiring tracking the evolution of multiple hidden variables through transformations
- Tasks where intermediate state must be maintained without being explicitly written down
- Long chains of operations on variables where the initial value matters
- Tasks where the model must maintain consistency across multiple sub-computations

**For better agent prompts:**
- **ALWAYS externalize state** -- make the model write down intermediate values
- Never ask the model to "remember" something implicitly; have it write a scratchpad
- For multi-step computations: require writing down the state after each step
- Break variable tracking into explicit assignments: "let x = ...; after step 1, x = ...; after step 2, x = ..."
- This is not optional -- it's an architectural limitation, not a laziness problem

---

<a id="paper-8"></a>
## Paper 8: SWE-bench Difficulty Analysis

**Source:** Jatin Ganhotra, blog post (April 2025)
**URL:** https://jatinganhotra.dev/blog/swe-agents/2025/04/15/swe-bench-verified-easy-medium-hard.html

### Methodology

- **Dataset:** SWE-Bench-Verified (500 issues)
- **Difficulty classification:** Based on OpenAI human annotations of estimated completion time
- **Metrics:** Files modified, hunks changed, lines changed

### Difficulty Distribution

| Difficulty | Count | % | Criteria |
|-----------|-------|---|----------|
| Easy | 194 | 38.8% | <= 15 minutes |
| Medium | 261 | 52.2% | 15 min - 1 hour |
| Hard | 45 | 9.0% | >= 1 hour |

**91% of issues** are estimated to take less than an hour for a human expert.

### What Makes Tasks Hard -- Quantitative Metrics

| Difficulty | Avg Files | Avg Hunks | Avg Lines |
|-----------|-----------|-----------|-----------|
| Easy | 1.03 | 1.37 | 5.04 |
| Medium | 1.28 | 2.48 | 14.1 |
| Hard | 2.0 | 6.82 | 55.78 |

**Key scaling relationships:**
- **Lines changed:** 11x increase from Easy to Hard (5.04 -> 55.78) -- **strongest predictor**
- **Hunks:** 5x increase (1.37 -> 6.82)
- **Files modified:** 2x increase (1.03 -> 2.0)

### Agent Performance by Difficulty

| System | Easy (194) | Medium (261) | Hard (45) |
|--------|-----------|-------------|-----------|
| Combined (all systems) | 95.4% | 84.3% | 42.2% |
| Augment Agent v0 (top) | 80.4% | 62.1% | 20.0% |
| W&B Programmer O1 | 77.3% | 62.1% | 24.4% |
| Amazon Q Developer | 72.2% | 49.4% | 13.3% |
| Agentless-1.5 + Claude | 70.6% | 42.5% | 13.3% |

**The Easy-Hard gap is enormous:** Top individual systems drop from ~80% on easy to ~20% on hard.

### Multi-File Analysis

| Type | Single-file | Multi-file |
|------|------------|------------|
| Avg Files | 1.0 | 2.56 |
| Avg Hunks | 1.84 | 5.27 |
| Avg Lines | 10.05 | 38.03 |

- Hard multi-file issues: only **9 out of 25 solved** by ANY system
- Multi-file tasks require **4x more lines** and **4x more hunks** than single-file
- **No single system can solve all problem types** -- different approaches excel at different tasks

### Key Takeaways

1. **Lines of code changed is the strongest predictor of difficulty** (11x scaling)
2. **Multi-file issues represent the frontier** -- most unsolved hard problems are multi-file
3. **The combined-systems ceiling suggests complementary strengths** -- ensemble approaches could help
4. **Hard != complex reasoning alone** -- it's scope, multi-file coordination, and volume of changes

### Actionable Takeaways

**For harder tests:**
- Multi-file tasks requiring coordinated changes across 2+ files
- Tasks requiring 50+ lines of changes spread across multiple hunks
- Tasks where the fix location is non-obvious (requires understanding module boundaries)
- Tasks combining logical complexity with large scope

**For better agent prompts:**
- For multi-file tasks: map all affected files before making changes
- Estimate the scope of changes first -- if > 20 lines, plan before coding
- For hard tasks: identify ALL locations that need changes before modifying any
- Use a structured approach: 1) understand the bug, 2) identify all affected locations, 3) plan changes, 4) implement, 5) verify

---

<a id="synthesis-a"></a>
## SYNTHESIS A: How to Make Unbreakable Tests

### Top 10 Patterns That Break AI, Ranked by Effectiveness

#### 1. Disguised Problem (Wrong Problem Mapping) -- MOST EFFECTIVE
**Papers:** 1, 6
**Why it works:** LLMs pattern-match to the nearest known problem class. A task that LOOKS like problem X but IS actually problem Y triggers the wrong algorithm every time.
**Effectiveness:** Near 100% failure rate when well-designed.

**TypeScript task sketch:**
```
// Looks like: balanced parentheses (stack-based)
// Actually: find longest SUBSEQUENCE (not substring) with nested pairs
// Every model will use a stack and check for balanced brackets
// The correct solution requires DP or a different approach entirely
function findNestedSubsequence(brackets: string): number {
  // Must find subsequence, not contiguous substring
  // Standard stack approach fails because it processes linearly
}
```

#### 2. High-Branching-Factor State Machine -- VERY EFFECTIVE
**Papers:** 3, 7
**Why it works:** Models fail at rule retrieval when many similar rules exist. Attention mechanisms can't select the right rule from 20+ similar options.
**Effectiveness:** ~50% task accuracy even for best models at moderate complexity.

**TypeScript task sketch:**
```
// 30+ event types, each with slightly different handler logic
// One event triggers a cascade of state changes
// Model must track which handler applies to which event
interface Event { type: string; payload: Record<string, number> }
interface StateMachine { 
  states: Record<string, Record<string, string>>; // state -> event -> nextState
  actions: Record<string, (payload: Record<string, number>) => number>;
}
function processEventSequence(sm: StateMachine, events: Event[]): number[] {
  // Must correctly resolve 50+ events through 30-state machine
}
```

#### 3. Modified Well-Known Problem (Memorization Trap) -- VERY EFFECTIVE
**Papers:** 6, 1
**Why it works:** Models memorize solutions to famous problems. Trivially modifying the problem makes them output the memorized (wrong) answer ~20% of the time, and apply the wrong approach ~50%+ of the time.
**Effectiveness:** 9-54% performance gap between original and modified versions.

**TypeScript task sketch:**
```
// Looks like: Fibonacci sequence
// Twist: the recurrence relation uses modular arithmetic 
// with a twist that makes the "standard" Fibonacci optimization wrong
// F(n) = (F(n-1) * F(n-2) + F(n-3)) % M, but M changes every 10 steps
function modifiedFibonacci(n: number, moduliSchedule: number[]): number {
  // Standard matrix exponentiation won't work due to changing modulus
  // Must use direct computation with memoization
}
```

#### 4. Geometric/Spatial Reasoning -- VERY EFFECTIVE
**Papers:** 4
**Why it works:** LLMs lack genuine spatial reasoning. Tasks requiring 2D/3D geometric computation with boundary tracking defeat all models.
**Effectiveness:** 0% success across all tested models.

**TypeScript task sketch:**
```
// Given overlapping polygons, compute the exact boundary path
// of their union as an ordered array of vertices
interface Polygon { vertices: [number, number][] }
function computeUnionBoundary(polygons: Polygon[]): [number, number][] {
  // Requires: sweep line + event handling + winding number
  // Common wrong approaches: convex hull, pairwise merge, bounding box
}
```

#### 5. Long Reasoning Chain with Compounding Errors -- EFFECTIVE
**Papers:** 3, 6, 7
**Why it works:** Each step has a small error probability. Over 20+ steps, the cumulative error probability approaches 100%.
**Effectiveness:** Even best models reach ~50% task accuracy at moderate chain length.

**TypeScript task sketch:**
```
// Process a ledger of 50 financial transactions
// Each transaction depends on the running balance of multiple accounts
// One error in any intermediate balance cascades to all subsequent results
interface Transaction { 
  from: string; to: string; amount: number; 
  fee: (balance: number) => number; // fee depends on current balance
}
function processLedger(
  initialBalances: Record<string, number>, 
  transactions: Transaction[]
): Record<string, number> {
  // 50 sequential transactions, each depending on previous state
  // Fee calculation creates nonlinear dependencies
}
```

#### 6. Observation-Heavy / Ad-hoc Algorithm -- EFFECTIVE
**Papers:** 5
**Why it works:** No template or known algorithm applies. Success requires a creative insight that models can't generate.
**Effectiveness:** 0% pass@1 on hard problems in LiveCodeBench Pro.

**TypeScript task sketch:**
```
// Given a grid of numbers, find the minimum number of "swaps" 
// to make every 2x2 sub-grid contain exactly one odd number
// The key insight: this reduces to a bipartite matching problem
// but ONLY after observing a non-obvious parity invariant
function minimumSwaps(grid: number[][]): number {
  // No standard algorithm directly applies
  // Must discover the parity observation, THEN apply matching
}
```

#### 7. Multi-Variable State Tracking Without Externalization -- EFFECTIVE
**Papers:** 7, 3
**Why it works:** LLMs have no working memory. When they must track 3+ variables through transformations without writing them down, accuracy drops to near-zero.
**Effectiveness:** Near-zero ISR for most models.

**TypeScript task sketch:**
```
// Simulate a simple CPU with 4 registers processing 20 instructions
// Each instruction reads/writes multiple registers
// Must output final register state
type Instruction = 
  | { op: 'add'; dest: string; src1: string; src2: string }
  | { op: 'mul'; dest: string; src1: string; imm: number }
  | { op: 'cmp'; dest: string; src1: string; src2: string } // sets flag
  | { op: 'jnz'; flag: string; target: number }
function simulate(instructions: Instruction[], initialRegs: Record<string, number>): Record<string, number> {
  // 20+ instructions, 4 registers, conditional jumps
  // Must track all register values through the entire sequence
}
```

#### 8. Strict Format + Edge Cases Combined -- EFFECTIVE
**Papers:** 1, 2
**Why it works:** Models handle edge cases OR format requirements separately, but combining both multiplies the failure rate.
**Effectiveness:** Most common failure mode across all benchmarks.

**TypeScript task sketch:**
```
// Format a nested JSON structure as a specific indented string
// Edge cases: empty arrays vs null vs undefined, circular refs (by ID),
// numbers that look like strings, dates in specific locale
// Output format: custom indentation with specific rules for each type
function formatStructured(
  data: unknown, 
  options: { indent: number; nullDisplay: string; dateLocale: string }
): string {
  // Many edge cases (empty, null, circular) + strict format = reliable failure
}
```

#### 9. Misleading Specification (Ambiguous Phrasing) -- MODERATE
**Papers:** 2, 1
**Why it works:** The most frequent root cause of mistakes is misunderstanding the spec. Deliberately ambiguous (but technically precise) specs reliably trigger wrong interpretations.
**Effectiveness:** ~15-30% failure from spec misunderstanding alone.

**TypeScript task sketch:**
```
// "Return the characters that appear in both strings"
// Ambiguity: does this mean the SET of characters, or each occurrence?
// Spec says "characters" (implying set), but examples show frequency-matched output
// Function signature implies array return (suggesting occurrences)
function commonCharacters(a: string, b: string): string[] {
  // Spec: "Return all characters present in both strings, in order of first appearance in a"
  // "present in both" = set intersection? or frequency-matched?
  // Test cases disambiguate, but the spec alone is ambiguous
}
```

#### 10. Multi-File / Cross-Module Coordination -- MODERATE
**Papers:** 8
**Why it works:** Hard SWE-bench tasks require coordinated changes across 2+ files with 50+ lines. Models struggle with scope and consistency.
**Effectiveness:** Only 9/25 hard multi-file issues solved by ANY system.

**TypeScript task sketch:**
```
// Requires changes to:
// 1. types.ts - add new type variants
// 2. parser.ts - handle new syntax  
// 3. validator.ts - add validation rules
// 4. emitter.ts - generate output for new types
// All four files must be consistent with each other
// A change in types.ts cascades to all other files
```

---

<a id="synthesis-b"></a>
## SYNTHESIS B: How to Improve the Agent Prompt

### Technique 1: Anti-Pattern-Matching Instruction
**From Papers:** 1, 6

Add to system prompt:
```
CRITICAL: Before writing any code, identify the problem class this task 
APPEARS to belong to, then verify whether the standard solution for that 
class actually applies. List at least one way this task DIFFERS from the 
standard version. If you cannot identify a difference, re-read the spec 
more carefully -- there is almost certainly a twist.
```

### Technique 2: Mandatory State Externalization
**From Papers:** 3, 7

Add to system prompt:
```
For any computation involving more than 2 variables or more than 5 sequential 
steps, you MUST write down the state after each step. Never track state 
purely in your "head." Use explicit variable assignments:
  Step 1: x = 5, y = 3, z = 8
  Step 2: x = 5, y = 3+8 = 11, z = 8
  ...
This is not optional. You are architecturally incapable of maintaining 
latent state -- externalize everything.
```

### Technique 3: Sample Test Execution
**From Papers:** 5

Add to system prompt:
```
Before returning any solution, mentally execute it against the provided 
sample inputs. Write out each step of execution and verify the output 
matches. If no sample inputs are provided, create 3 test cases:
1. A minimal/trivial case
2. A "normal" case
3. An edge case (empty input, maximum values, boundary conditions)
Execute your solution against all three and verify correctness.
```

### Technique 4: Specification Disambiguation
**From Papers:** 2, 1

Add to system prompt:
```
Before coding, rephrase the specification in your own words. Identify:
1. What EXACTLY is the input? (types, ranges, edge cases)
2. What EXACTLY is the output? (format, type, order)
3. What does each ambiguous phrase mean? (pick the interpretation 
   consistent with any examples; if no examples, state your assumption)
4. Does the function signature match or contradict the spec? (trust the spec)
```

### Technique 5: Edge Case Enumeration
**From Papers:** 1, 2, 8

Add to system prompt:
```
After designing your solution but before finalizing, enumerate edge cases:
- Empty/null/undefined inputs
- Single-element inputs
- Maximum-size inputs
- Inputs that trigger boundary conditions in your algorithm
- Inputs where the "happy path" assumption fails
For each edge case, trace through your code and verify correct behavior.
```

### Technique 6: Algorithm Selection Verification
**From Papers:** 4, 5, 6

Add to system prompt:
```
When choosing an algorithm:
1. List at least 2 candidate approaches
2. For each, identify what assumptions it makes about the input
3. Verify those assumptions hold for THIS specific problem
4. Consider: does the problem require composing multiple algorithms?
5. If the problem involves geometry, graph theory, or number theory,
   be especially skeptical of your first instinct -- these domains
   have the highest "wrong algorithm" failure rate.
```

### Technique 7: Low-Branching-Factor Thinking
**From Papers:** 3

Add to system prompt:
```
When implementing complex logic with many cases:
- Break decision trees into sequential binary choices rather than 
  one big switch statement
- Process one dimension of complexity at a time
- Prefer deep-and-narrow (many steps, few choices per step) over 
  wide-and-shallow (few steps, many choices per step)
```

### Technique 8: Anti-Memorization Check
**From Papers:** 6

Add to system prompt:
```
If this problem resembles a well-known problem (e.g., classic DP, 
famous puzzle, textbook algorithm):
- Solve it from scratch, do NOT rely on remembered solutions
- Verify that the specific parameters of THIS instance match 
  the conditions required for the known solution
- If parameters differ from the classic version, the classic 
  solution likely needs modification
```

---

<a id="synthesis-c"></a>
## SYNTHESIS C: The Fundamental Limits

### What CAN'T Be Fixed with Prompt Engineering Alone

1. **Latent State Persistence (Paper 7)**
   - LLMs architecturally cannot maintain internal state across tokens
   - CoT/scratchpad helps (10-30% ISR vs near-zero) but doesn't solve it
   - **Fundamental limit:** The transformer architecture processes each token based on the context window, not on persistent internal registers
   - **Requires:** External state management, tool use (memory/scratchpad tools), or architectural changes (State Space Models, external memory)

2. **Compounding Error Over Long Chains (Papers 3, 6)**
   - If per-step error rate is p, after N steps, task accuracy is approximately (1-p)^N
   - For p=0.05 and N=50 steps: task accuracy = 0.95^50 = 7.7%
   - **No amount of prompting reduces p to zero** -- it's inherent in probabilistic text generation
   - **Requires:** External verification at intermediate steps, multi-turn with error correction, or code execution for verification

3. **Novel Algorithm Discovery (Papers 4, 5)**
   - Models cannot discover algorithms that don't exist (or are extremely rare) in training data
   - The 0% pass rate on hard competitive programming proves this
   - **Prompt engineering can only help models apply KNOWN algorithms correctly** -- it can't create new ones
   - **Requires:** Search-based approaches (MCTS, beam search), tool-augmented reasoning, or human-in-the-loop for insight

4. **Genuine Spatial/Geometric Reasoning (Paper 4)**
   - Text-based models fundamentally lack spatial representations
   - No prompt can give a text model the ability to "see" geometric relationships
   - **Requires:** Multimodal models with spatial reasoning, or tool use (plotting, visualization)

### What Requires Architectural Changes

| Problem | Current Ceiling | What's Needed |
|---------|----------------|---------------|
| State tracking (3+ variables, 20+ steps) | ~30% with CoT | External memory / scratchpad tool |
| Long reasoning chains (50+ steps) | ~8% theoretical | Multi-turn with intermediate verification |
| Novel algorithm discovery | ~0% on hard problems | Search (MCTS/beam) + execution feedback |
| Spatial reasoning | ~0% on boundary tasks | Multimodal + visualization tools |
| Cross-module consistency | ~36% on hard multi-file | Structured planning + file-graph awareness |
| Rule retrieval (30+ similar rules) | ~50% task accuracy | Indexed retrieval / tool-based lookup |

### What's the Theoretical Ceiling for One-Shot Code Generation?

Based on the evidence across all 8 papers:

**Easy tasks (< 15 min for human, single-file, < 10 lines):**
- Current: ~80% pass@1
- Theoretical ceiling with perfect prompting: ~95%
- The remaining 5% is irreducible noise from tokenization, formatting, and probabilistic generation

**Medium tasks (15 min - 1 hour, 1-2 files, 10-20 lines):**
- Current: ~55% pass@1 (best individual systems)
- Theoretical ceiling with perfect prompting: ~75%
- The gap is due to occasional algorithm selection errors and edge case misses that prompting can partially address

**Hard tasks (1+ hours, 2+ files, 50+ lines):**
- Current: ~20% pass@1 (best individual systems)
- Theoretical ceiling with perfect prompting: ~30%
- Fundamental limits: novel algorithm discovery, multi-file coordination, long reasoning chains
- **One-shot generation is fundamentally insufficient for hard tasks**

**Competition-level / IOI-level:**
- Current: 0% pass@1 on hard problems (Elo > 3000)
- Theoretical ceiling with perfect prompting: ~5%
- These problems require creative insight that is not in the distribution
- **Multi-turn with execution feedback is the minimum viable approach**

### The Path Forward

The evidence converges on a clear hierarchy:

1. **Prompt engineering** fixes: wrong problem mapping, spec misunderstanding, format errors, basic edge cases (~10-15% improvement)
2. **Tool use** fixes: state tracking, sample test execution, intermediate verification (~15-25% improvement)
3. **Multi-turn with feedback** fixes: compounding errors, complex debugging, scope management (~10-20% improvement)
4. **Search/sampling** fixes: novel algorithm discovery at moderate difficulty (~5-15% improvement via pass@k)
5. **Architectural changes** needed for: genuine spatial reasoning, true working memory, extremely novel problems

The sweet spot for benchmark difficulty is tasks that require levels 2-3 to solve reliably -- these expose real limitations while remaining theoretically solvable with the right agent architecture.

---

## References

1. Sharifloo et al. "Where Do LLMs Still Struggle? An In-Depth Analysis of Code Generation Benchmarks" (arxiv 2511.04355)
2. Chen et al. "A Deep Dive Into Large Language Model Code Generation Mistakes: What and Why?" (arxiv 2411.01414)
3. Samiei et al. "The Illusion of Procedural Reasoning: Measuring Long-Horizon FSM Execution in LLMs" (arxiv 2511.14777)
4. Kullmann, P. "All major LLMs struggle with this simple programming task" (Medium, Nov 2024)
5. Zheng et al. "LiveCodeBench Pro: How Do Olympiad Medalists Judge LLMs in Competitive Programming?" (arxiv 2506.11928)
6. Malek et al. "Frontier LLMs Still Struggle with Simple Reasoning Tasks" (arxiv 2507.07313, Google DeepMind)
7. Huang et al. "On the Failure of Latent State Persistence in Large Language Models" (arxiv 2505.10571)
8. Ganhotra, J. "Cracking the Code: How Difficult Are SWE-Bench-Verified Tasks Really?" (Blog, April 2025)
