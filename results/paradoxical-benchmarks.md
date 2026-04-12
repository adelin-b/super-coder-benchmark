# Paradoxical, Adversarial & Counter-Intuitive Coding Benchmarks

Research on benchmarks and techniques that deliberately TRICK AI models, where the obvious/common solution is WRONG.

**Context**: Our benchmark uses TypeScript + vitest. Sonnet 4.6 scores 97-100% on current "hard" tasks. We need tasks where the spec describes something that LOOKS simple but the correct implementation requires a non-obvious approach.

---

## Table of Contents

1. [Unpuzzles (Google DeepMind)](#1-unpuzzles---the-gold-standard-for-paradoxical-tasks)
2. [Wrong Problem Mapping](#2-wrong-problem-mapping---when-ai-picks-the-wrong-algorithm)
3. [GSM-Symbolic (Apple)](#3-gsm-symbolic---pattern-matching-not-reasoning)
4. [Counterfeit Conundrum](#4-counterfeit-conundrum---subtly-wrong-code-that-passes-weak-checks)
5. [Codehacks (Codeforces)](#5-codehacks---adversarial-edge-cases-from-competitive-programming)
6. [ReCode / Forticode / CodeFort](#6-recode--forticode--codefort---perturbation-based-robustness)
7. [EvalPlus / HumanEval+](#7-evalplus--humaneval---rigorous-test-augmentation)
8. [Agentic Property-Based Testing (Anthropic)](#8-agentic-property-based-testing---automated-adversarial-testing)
9. [SAFuzz / EvolveCoder](#9-safuzz--evolvecoder---semantic-fuzzing--adversarial-test-evolution)
10. [CRUXEval / CRUXEval-X / CodeSense / CodeGlance](#10-cruxeval--codesense--codeglance---execution-reasoning)
11. [Idea First Code Later](#11-idea-first-code-later---separating-reasoning-from-coding)
12. [LLM Code Generation Mistake Taxonomy](#12-llm-code-generation-mistake-taxonomy)
13. [Synthesis: How to Build Paradoxical Tasks for Our Benchmark](#13-synthesis-for-our-benchmark)

---

## 1. Unpuzzles -- The Gold Standard for Paradoxical Tasks

**Paper**: "Frontier LLMs Still Struggle with Simple Reasoning Tasks" (arxiv 2507.07313, Google DeepMind, 2025)
**Repository**: https://github.com/google-deepmind/unpuzzles_and_simple_reasoning/
**Type**: Benchmark dataset (97 puzzles + trivialized versions)

### How It Works

Take a well-known puzzle. Make a MINIMAL textual edit that makes the answer trivially obvious. LLMs still get it wrong because they pattern-match to the memorized original.

### Concrete Examples

**Chameleon Problem (Original)**:
> 13 purple, 15 yellow, and 17 maroon chameleons on an island. When two different-coloured chameleons meet, they both turn into the third color. Is it possible that all chameleons are the same color?
> **Answer**: No (proof by contradiction using modular invariant)

**Chameleon Problem (Unpuzzle)**:
> **15** purple, 15 yellow, and 17 maroon chameleons on an island. When two different-coloured chameleons meet, they both turn into the third color. Is it possible that all chameleons are the same color?
> **Answer**: YES (purple and yellow are equal, they all pair up trivially)

The ONLY change is 13 -> 15. The answer flips from "no" to "yes". LLMs still output "no" with the original proof.

**Locker Problem (Original)**:
> 100 lockers, all closed. Person 1 opens every locker. Person 2 closes every 2nd. Person 3 toggles every 3rd... How many lockers are open after 100 people?
> **Answer**: 10 (perfect squares)

**Locker Problem (Unpuzzle)**:
> 100 lockers, all closed. A person walks down and opens every locker. **How many lockers are open?**
> **Answer**: 100 (trivially, they just opened them all)

LLMs still answer "10" because they recognize the locker-pattern and apply the memorized solution.

### Performance Gaps

| Model | Puzzles (%) | Unpuzzles (%) | Gap |
|-------|-------------|---------------|-----|
| Gemini 1.5 | 85% | 31% | **54%** |
| o3 | 93% | 84% | **9%** |
| o1 | 86% | 63% | **23%** |
| DeepSeek R1 | 80% | 54% | **26%** |
| GPT-4o | 80% | 43% | **37%** |
| Claude 3.5 Sonnet | 73% | 35% | **38%** |

Even o3 has a 9% gap. Non-thinking models lose 37-54%.

### Context-Shifted Unpuzzles

To prove it is memorization, they also created "context-shifted" versions: same logic as the unpuzzle, but with completely different surface text. Models perform BETTER on context-shifted versions than on unpuzzles, confirming that textual similarity to the original puzzle causes failures.

### Key Failure Patterns

1. **Reasoning delirium**: Model applies the original puzzle's complex reasoning even when the answer is trivially obvious
2. **Statistical shortcuts**: Pattern-matching to memorized training data
3. **Ignoring modified constraints**: Reading the original constraint instead of the modified one

### Can We Use It?

YES -- dataset is public. The methodology is directly transferable to code:
- Write a spec that LOOKS like a classic algorithm problem
- Make a small twist that makes the textbook solution wrong
- The correct solution is actually simpler/different

---

## 2. Wrong Problem Mapping -- When AI Picks the Wrong Algorithm

**Paper**: "Where Do LLMs Still Struggle? An In-Depth Analysis of Code Generation Benchmarks" (arxiv 2511.04355, 2025)
**Type**: Empirical analysis of 114 consistently-failed tasks across 4 benchmarks

### What It Is

Analysis of tasks that ALL major LLMs (Claude Sonnet 4, DeepSeek-V3, Qwen3-Coder, GPT-4o, Llama-3.3-70B, Mistral-3.2-24B) consistently fail on. Identified four recurring failure patterns.

### The Four Failure Patterns

1. **Wrong problem mapping**: Model interprets the task as belonging to the wrong problem class
2. **Flawed or incomplete algorithm design**: Correct approach but missing steps
3. **Edge case mishandling**: Fails on boundary conditions
4. **Formatting mistakes**: Output format doesn't match spec

### Concrete Example: Wrong Problem Mapping

**HumanEval/132**: Determine whether a string of square brackets contains a valid subsequence with at least one nested pair.

ALL models incorrectly mapped this to the standard "balanced brackets" problem and used a stack-based approach that returns `True` as soon as ANY nesting is detected. The actual requirement is to check whether sufficient nesting exists across the entire string.

This is exactly our target pattern: the problem LOOKS like "balanced brackets" (a textbook problem) but has a subtle twist that makes the standard algorithm wrong.

### Key Insight

> "Complexity alone did not fully account for these failures, suggesting that additional factors play a significant role."

This means hard-to-solve != paradoxical-to-solve. Simple problems with familiar surface patterns but subtle differences are MORE dangerous than genuinely complex problems.

### Can We Use It?

The paper identifies specific failed tasks across HumanEval, MBPP, BigCodeBench, and LiveCodeBench. The 114 failed tasks are a goldmine for designing paradoxical variants.

---

## 3. GSM-Symbolic -- Pattern Matching Not Reasoning

**Paper**: "GSM-Symbolic: Understanding the Limitations of Mathematical Reasoning in Large Language Models" (Apple, ICLR 2025)
**Type**: Benchmark with symbolic templates

### How It Works

Takes GSM8K math problems and creates variants using templates with different numbers. Also adds irrelevant-but-plausible information.

### Key Finding

Adding irrelevant but seemingly related information causes a performance drop of **up to 65%**. LLMs are pattern-matching, not reasoning.

### Relevance to Code

The same principle applies to code specs: add context that LOOKS relevant but should be ignored. If the spec mentions a "sorted array" in passing but the actual requirement doesn't need sorting, the model will sort anyway.

---

## 4. Counterfeit Conundrum -- Subtly Wrong Code That Passes Weak Checks

**Paper**: "The Counterfeit Conundrum: Can Code Language Models Grasp the Nuances of Their Incorrect Generations?" (MIT/Cornell/UC Berkeley, ACL 2024)
**Website**: https://counterfeit-code.github.io/
**Type**: Benchmark + analysis framework

### What It Is

"Counterfeit samples" are programs that:
1. Have high log-probability (model confidently generates them)
2. Are incorrect
3. Pass weak correctness checks (compile, pass basic tests)

### Three Failure Modes

1. **Misclassification**: Models classify counterfeit code as correct
2. **Wrong execution prediction**: Models predict counterfeit code will execute as if it were correct
3. **Repair failure**: Likelihood of fixing a counterfeit is LOWER than generating correct code from scratch

### Why This Matters for Us

This is the inverse perspective: instead of tricking the model into writing wrong code, study the KIND of wrong code models naturally produce. These "counterfeit" patterns reveal the subtle bugs that pass basic validation. We can design tasks that specifically target these blind spots.

### Datasets

HumanEval, LeetCode, ODEX with counterfeit examples from Code Llama, DeepSeek-Coder, StarCoder.

---

## 5. Codehacks -- Adversarial Edge Cases from Competitive Programming

**Paper**: "Codehacks: A Dataset of Adversarial Tests for Competitive Programming Problems Obtained from Codeforces" (ICST 2025)
**Dataset**: https://doi.org/10.6084/m9.figshare.24773754
**Type**: 288,617 adversarial test cases for 5,578 problems

### What It Is

On Codeforces, competitors can "hack" each other's solutions by submitting edge-case inputs that break them. This dataset collects those hacks -- real adversarial test cases created by expert humans to break subtly-wrong solutions.

### Why It Is Gold

These are NOT random edge cases. Each hack was crafted by a human who:
1. Read the problem carefully
2. Identified a subtle misunderstanding or edge case
3. Constructed a specific input that exploits it

### Scale

- 288,617 hacks for 5,578 problems
- 2,196 submitted solutions that can be broken by their hacks
- Natural language problem descriptions included

### Can We Use It?

YES -- the dataset is public. The hack inputs reveal exactly which edge cases trip up naive solutions. We can translate competitive programming problems to TypeScript and use the hack inputs as our adversarial test cases.

---

## 6. ReCode / Forticode / CodeFort -- Perturbation-Based Robustness

### ReCode (Amazon, ACL 2023)
**Paper**: arxiv 2212.10264
**Repository**: https://github.com/amazon-science/recode
**Type**: 30+ semantic-preserving transformations

Perturbation types:
1. **Docstring perturbations** (via NLAugmenter): synonym replacement, back-translation, typos
2. **Function name perturbations**: rename to misleading/generic names
3. **Code syntax perturbations** (via NatGen): naturalistic code transformations
4. **Code format perturbations**: whitespace, line breaks, comment style

Key finding: slight edits to a prompt lead to very different generations. Over 90% of perturbations preserve semantic meaning.

### Forticode (Stanford, 2025)
~50 AST transformations + instruction mutations. Granular assessment across programming concepts.

### CodeFort (Amazon, 2024)
Perturbation-aware training to improve robustness.

### Relevance to Our Benchmark

These show that models are FRAGILE to surface-level changes. We can exploit this:
- Write specs with unusual formatting or naming conventions
- Use non-standard terminology that means the same thing
- Include misleading function names that suggest the wrong approach

---

## 7. EvalPlus / HumanEval+ -- Rigorous Test Augmentation

**Paper**: "Is Your Code Generated by ChatGPT Really Correct?" (NeurIPS 2023)
**Repository**: https://github.com/evalplus/evalplus
**Type**: 80x test augmentation framework

### How It Works

Takes HumanEval's ~10 test cases per problem and generates 800+ using:
- LLM-generated seed inputs (30 per task via 3 prompts)
- Type-aware mutation (1000 additional inputs per task)

### Impact

Reduces pass@k by **19.3-28.9%** compared to original HumanEval. Code that passes basic tests frequently fails on edge cases.

### Key Insight for Us

The gap between "passes basic tests" and "passes rigorous tests" is where AI-generated code fails. Our paradoxical tasks should have:
- Few obvious test cases that naive solutions pass
- Many subtle edge cases that only correct implementations handle

---

## 8. Agentic Property-Based Testing -- Automated Adversarial Testing

**Paper**: "Agentic Property-Based Testing: Finding Bugs Across the Python Ecosystem" (Anthropic, NeurIPS DL4Code 2025)
**Repository**: https://github.com/mmaaz-git/agentic-pbt
**Type**: LLM agent + Hypothesis framework for automated bug discovery

### How It Works

1. Agent reads module code, type annotations, docstrings
2. Infers properties that should hold (invariants, commutativity, idempotency, etc.)
3. Generates Hypothesis-based property tests
4. Executes tests, reflects on failures
5. Outputs bug reports with reproducible examples

### Results

- 56% of generated bug reports were valid bugs
- 86% of top-scoring bugs were valid
- Found bugs in NumPy, SciPy, cloud SDKs
- 3 patches merged

### Concrete Bug Example: NumPy Wald Distribution

```python
# Property: Wald distribution should NEVER produce negative values
# Bug: numpy.random.wald(mean=1e8, scale=1.0) produces negative values
# This is a numerical precision bug in the sampling algorithm
```

The agent inferred the property "output >= 0" from the mathematical definition, then found inputs where it violated.

### Bug Categories

- **Logic**: Incorrect results, violated mathematical properties
- **Crash**: Valid inputs cause unhandled exceptions
- **Contract**: API differs from documentation/type hints

### Can We Use This Methodology?

YES -- and it maps directly to TypeScript + vitest:
- Use **fast-check** (@fast-check/vitest) as our Hypothesis equivalent
- Design tasks where the SPEC implies invariants
- Test whether AI-generated code satisfies those invariants for all inputs
- The invariants become our paradoxical test cases

### fast-check Integration

```typescript
import { test, fc } from '@fast-check/vitest';

test.prop([fc.integer(), fc.integer()])('addition is commutative', (a, b) => {
  expect(add(a, b)).toBe(add(b, a));
});
```

**Package**: `@fast-check/vitest` -- native vitest integration, released March 2025.

---

## 9. SAFuzz / EvolveCoder -- Semantic Fuzzing & Adversarial Test Evolution

### SAFuzz (arxiv 2602.11209, February 2026)

Semantic-guided adaptive fuzzing for LLM-generated code:
- Prompt variations to simulate diverse user interactions
- LLM-guided fuzz harness with problem-specific oracles
- Vulnerability predictor for adaptive resource allocation
- Improves bug detection recall from 67.3% to 79.5%

### EvolveCoder (arxiv 2603.12698, March 2026)

Adversarial test evolution for code reinforcement learning:
- Iteratively refines test cases based on execution behaviors of candidate solutions
- Increases difficulty and discriminative power of test suites
- Pass@1 decreases from 43.80 to 31.22 after evolution
- Creates EvolveCoder-22k dataset with evolved adversarial tests

### Code-A1 (arxiv 2603.15611, March 2026)

Adversarial co-evolution of code LLM and test LLM:
- Code generator and test generator compete via reinforcement learning
- Test generator learns to create inputs that break the code generator
- Both improve through adversarial training

### ATGen (ICLR 2026)

Adversarial test case generation via reinforcement learning -- extends scaling laws for test generation.

### Relevance

These represent the cutting edge of automated adversarial test creation. The key insight: test cases should be **conditioned on candidate solutions** to target their specific weaknesses.

---

## 10. CRUXEval / CRUXEval-X / CodeSense / CodeGlance -- Execution Reasoning

### CRUXEval (Facebook Research, ICLR 2025)
**Repository**: https://github.com/facebookresearch/cruxeval

800 Python functions with input/output prediction tasks. Even GPT-4 with CoT only achieves 75%/81% on input/output prediction. Code generation ability does NOT correlate with code reasoning ability.

### CRUXEval-X (ACL 2025)

Multilingual extension: 19 languages including TypeScript, 12,660 subjects, 19K test cases. TypeScript results available.

### CodeSense (Microsoft, ICLR 2026)
**Website**: https://codesense-bench.github.io/

Real-world code semantic reasoning from 544 Python + 100 C + 100 Java projects. Fine-grained execution trace tasks. Clear performance gap even with CoT and in-context learning.

### CodeGlance (February 2026)

Three difficulty levels: intrinsic logic, API interactions, unknown functions. Key finding: dynamic execution features impact reasoning MORE than static code structure.

### Relevance

These show that LLMs cannot reliably predict what code DOES. Our paradoxical tasks can exploit this: write specs where understanding the execution semantics is crucial, and the "obvious" implementation has subtly different execution behavior.

---

## 11. Idea First, Code Later -- Separating Reasoning from Coding

**Paper**: "Idea First, Code Later: Disentangling Problem Solving from Code Generation in Evaluating LLMs for Competitive Programming" (arxiv 2601.11332, January 2026)

### Key Finding

Even with GOLD editorials (expert-written algorithmic explanations), models still struggle with implementation. The gap between generated and gold editorials reveals a persistent problem-solving bottleneck.

Two distinct failure modes:
1. **Wrong algorithm selection** (reasoning failure)
2. **Correct algorithm, wrong implementation** (coding failure)

### Relevance

Our paradoxical tasks should target failure mode #1: problems where the model selects the wrong algorithm because the surface pattern matches a familiar problem.

---

## 12. LLM Code Generation Mistake Taxonomy

**Paper**: "A Deep Dive Into Large Language Model Code Generation Mistakes: What and Why?" (UC Irvine, arxiv 2411.01414)

### Seven Categories of Non-Syntactic Mistakes

1. **Conditional Error (CE)**: Omit or misinterpret conditions -- flawed logic or missing branches
2. **Garbage Code (GC)**: Unnecessary/irrelevant code (55-64% of failures for tasks >150 words)
3. **Misorder of Operations on Objects/Variables (MOOV)**: Operations in wrong sequence
4. **Misuse of Library API (MLA)**: Wrong API call or wrong parameters
5. **Index Off Mistake (IOM)**: Off-by-one errors, wrong indexing
6. **Mathematical Formula and Logic Error (MFLE)**: Wrong math/logic
7. **Misaligned Algorithm (MA)**: Fundamentally wrong approach for the task

### Six Reasons Behind Mistakes

1. **Misleading Coding Question Specification (MCQS)**: Ambiguous spec
2. **Misleading Function Signature (MFS)**: Function name suggests wrong approach
   - Example: `remove_duplicates` led Gemini to remove duplicate elements instead of ALL elements that have duplicates (spec said "remove all elements occurring more than once")
3. **Ambiguous Context**: Spec can be interpreted multiple ways
4. **Hallucination**: Model invents non-existent APIs or behaviors
5. **Complexity Overflow**: Task exceeds model's reasoning capacity
6. **Training Data Bias**: Model defaults to common patterns

### Directly Usable Patterns

The **Misleading Function Signature** pattern is immediately actionable:
```typescript
// Function name suggests one thing, spec says another
export function removeDuplicates(arr: number[]): number[] {
  // Spec: Remove ALL elements that appear more than once
  // Wrong (what name suggests): Remove duplicate copies, keep one
  // Right: Remove every element whose count > 1
}
```

---

## 13. Synthesis for Our Benchmark

### Paradoxical Task Design Patterns

Based on all the research above, here are concrete patterns for creating tasks that trick AI:

#### Pattern 1: Unpuzzle Pattern (from Unpuzzles)
Take a well-known algorithm problem. Make a small change that makes the standard algorithm wrong.

```
Example: "Given a sorted array, find the element that appears more than n/2 times"
Twist: The array is sorted in DESCENDING order (not ascending)
Standard: Boyer-Moore voting assumes no particular order, still works
But models might apply binary search assuming ascending order
```

#### Pattern 2: Misleading Name Pattern (from Mistake Taxonomy)
Function name or spec language suggests a familiar algorithm, but the actual requirement is different.

```
Example: function balanceParentheses(s: string): boolean
Spec: "Return true if the string can be MADE balanced by removing at most one character"
Standard balanced-check is wrong. Needs a different algorithm entirely.
```

#### Pattern 3: Irrelevant Context Pattern (from GSM-Symbolic)
Include plausible-but-irrelevant information that causes models to overcomplicate.

```
Example: "Given an array of prices over n days, and a maximum of k transactions,
find the maximum profit. Note: there is a 0.1% transaction fee on each trade."
Twist: k = infinity and fee = 0, so the answer is just sum of all positive differences
But models will implement the full k-transaction DP with fees
```

#### Pattern 4: Familiar Surface, Different Depth (from Wrong Problem Mapping)
Problem LOOKS like a classic problem class but requires different handling.

```
Example: "Validate a sequence of brackets: [], {}, ()"
Twist: "Brackets can overlap: [{]} is VALID in this system"
Standard stack-based validation fails completely.
```

#### Pattern 5: Trivial Edge That Dominates (from Codehacks)
The general case is complex, but the actual test inputs hit a trivial edge case.

```
Example: Implement Dijkstra's shortest path
Test case: Graph has only 1 node (answer is 0)
Test case: Graph has negative weights (Dijkstra doesn't work, need Bellman-Ford)
Models implement Dijkstra correctly but miss the edge cases
```

#### Pattern 6: Inverse Property (from Property-Based Testing)
The spec implies a mathematical property that the obvious implementation violates for edge inputs.

```
Example: "Implement a function that converts between Celsius and Fahrenheit"
Property: toFahrenheit(toCelsius(x)) === x (roundtrip)
Obvious implementation uses floating point, fails roundtrip for many values
Correct: Use exact arithmetic or accept epsilon tolerance
```

#### Pattern 7: Off-By-One in Spec Language (from EvalPlus)
Spec uses inclusive/exclusive language ambiguously.

```
Example: "Return elements from index i to j"
Does "to" mean inclusive or exclusive?
Spec says "inclusive" but models default to Python slice behavior (exclusive end)
```

### Recommended Implementation Priority

| Priority | Pattern | Difficulty to Implement | Expected Failure Rate |
|----------|---------|------------------------|-----------------------|
| 1 | Misleading Name (Pattern 2) | Low | High |
| 2 | Familiar Surface (Pattern 4) | Medium | Very High |
| 3 | Unpuzzle (Pattern 1) | Medium | High |
| 4 | Inverse Property (Pattern 6) | Medium | Medium-High |
| 5 | Irrelevant Context (Pattern 3) | Low | Medium |
| 6 | Trivial Edge (Pattern 5) | Low | Medium |
| 7 | Off-By-One Spec (Pattern 7) | Low | Medium |

### Tools for Automated Adversarial Testing

| Tool | Language | Integration | Purpose |
|------|----------|-------------|---------|
| **@fast-check/vitest** | TypeScript | Native vitest | Property-based testing |
| **fast-check** | TypeScript | Any runner | QuickCheck-style PBT |
| **Hypothesis** | Python | pytest | PBT (reference impl) |
| **EvalPlus** | Python | Standalone | Test augmentation |
| **CodeHacks dataset** | Multi-lang | Dataset | Adversarial test inputs |

### Key Metrics from Research

- **Unpuzzles**: 9-54% performance gap from trivial modifications
- **EvalPlus**: 19-29% pass rate reduction with rigorous tests
- **GSM-Symbolic**: Up to 65% drop from irrelevant context
- **Wrong Problem Mapping**: 100% failure rate when all models map to wrong class
- **Misleading Function Names**: Single rename can flip correctness
- **Counterfeit Code**: Repair success < fresh generation success
- **Property-Based Testing**: 3x more bugs found vs example-based tests

---

## Sources

### Primary Papers (Directly Relevant)

- [Unpuzzles: Frontier LLMs Still Struggle with Simple Reasoning Tasks](https://arxiv.org/abs/2507.07313) -- Google DeepMind, 2025
- [Where Do LLMs Still Struggle?](https://arxiv.org/html/2511.04355v1) -- Wrong problem mapping taxonomy, 2025
- [GSM-Symbolic](https://arxiv.org/pdf/2410.05229) -- Apple, ICLR 2025
- [The Counterfeit Conundrum](https://counterfeit-code.github.io/) -- MIT/Cornell/Berkeley, ACL 2024
- [Codehacks](https://arxiv.org/html/2503.23466v1) -- Adversarial Codeforces dataset, ICST 2025
- [ReCode](https://arxiv.org/abs/2212.10264) -- Amazon, ACL 2023
- [EvalPlus](https://github.com/evalplus/evalplus) -- NeurIPS 2023
- [Agentic Property-Based Testing](https://arxiv.org/html/2510.09907v1) -- Anthropic, NeurIPS DL4Code 2025
- [A Deep Dive Into LLM Code Generation Mistakes](https://arxiv.org/html/2411.01414v1) -- UC Irvine, 2024
- [Idea First, Code Later](https://arxiv.org/abs/2601.11332) -- MBZUAI/NAIST/NUS, January 2026

### Cutting-Edge (2026)

- [SAFuzz: Semantic-Guided Adaptive Fuzzing](https://arxiv.org/abs/2602.11209) -- February 2026
- [EvolveCoder: Adversarial Test Evolution](https://arxiv.org/abs/2603.12698) -- March 2026
- [Code-A1: Adversarial Co-Evolution](https://arxiv.org/abs/2603.15611) -- March 2026
- [ATGen: Adversarial RL Test Generation](https://iclr.cc/virtual/2026/poster/10009371) -- ICLR 2026
- [CodeSense: Real-World Code Semantic Reasoning](https://arxiv.org/abs/2506.00750) -- Microsoft, ICLR 2026
- [CodeGlance: Multi-Dimensional Feature Analysis](https://arxiv.org/abs/2602.13962) -- February 2026
- [CodeHacker: Automated Adversarial Test Generation](https://arxiv.org/html/2602.20213) -- February 2026
- [CodeContests+: High-Quality Test Cases](https://arxiv.org/abs/2506.05817) -- 2025

### Execution Reasoning

- [CRUXEval](https://crux-eval.github.io/) -- Facebook Research, ICLR 2025
- [CRUXEval-X: Multilingual (19 languages incl. TypeScript)](https://arxiv.org/abs/2408.13001) -- ACL 2025
- [SemCoder: Semantic Code Execution Reasoning](https://arxiv.org/abs/2406.01006) -- NeurIPS 2024

### Robustness & Perturbation

- [Forticode: AST Transformations](https://web.stanford.edu/class/cs224n/final-reports/256912126.pdf) -- Stanford, 2025
- [CodeFort: Robust Training](https://arxiv.org/abs/2405.01567) -- Amazon, 2024
- [Multi-Language Robustness Perspective](https://arxiv.org/html/2504.19108v1) -- 2025

### Tools

- [fast-check (TypeScript PBT)](https://github.com/dubzzz/fast-check)
- [@fast-check/vitest](https://www.npmjs.com/package/@fast-check/vitest) -- Native vitest integration
- [Hypothesis (Python PBT)](https://hypothesis.readthedocs.io/)
- [Agentic PBT code](https://github.com/mmaaz-git/agentic-pbt)

### Datasets

- [Unpuzzles dataset](https://github.com/google-deepmind/unpuzzles_and_simple_reasoning/)
- [Codehacks dataset (288K hacks)](https://doi.org/10.6084/m9.figshare.24773754)
- [ReCode perturbations](https://github.com/amazon-science/recode)
- [EvalPlus/HumanEval+](https://github.com/evalplus/evalplus)
- [CRUXEval](https://github.com/facebookresearch/cruxeval)
- [CodeSense](https://codesense-bench.github.io/)
- [EvolveCoder-22k](https://arxiv.org/abs/2603.12698)
