# effect-god/v1 — Ultimate Effect TS Agent

Combines all winning patterns from 350+ experimental runs into a single 10-step pipeline.

## Pipeline Steps

| Step | Purpose | Evidence |
|------|---------|----------|
| 1. Spec Parsing | Extract export names, types, error conditions | Bottleneck #1: interface mismatch causes ~40% of failures |
| 2. Test Analysis | Match exact import names, method calls, event type casing | SAAS-3 fails because agents use 'Deposited' instead of 'deposited' (Rank #7) |
| 3. Domain Invariants | Identify 3 key properties that must hold | PBT thinking improves logic correctness (effect-pbt: 83.3% L2) |
| 4. Architecture Decision | Choose factory/class/function pattern from test usage | BL-5 fails 100% when agents generate class instead of factory (Rank #1) |
| 5. Effect Implementation | Core logic with Effect.gen, Data.TaggedError | Effect boundary wrapping = +23% improvement (effect-ts v1->v3) |
| 6. Boundary Wrapping | runSync + try/catch for every export | #1 failure mode: FiberFailure leaking to tests. Longest section by design. |
| 7. Validation Layer | Input validation before Effect execution | Missing validation = 1-2 test failures on BL-2 (bottleneck analysis) |
| 8. Self-Critique | Find 3 specific bugs and fix them | Critique + Validation only combo that cracks BL-5 at 75% (factorial experiment) |
| 9. Invariant Verification | Mental trace of each invariant | Catches logic errors that critique alone misses |
| 10. Final Checklist | Verify every known failure mode | Checklist prevents submission of incomplete code (factorial finding) |

## Design Decisions

- **Under 800 words**: ultra-ts at 782 words (93.3% HARD) beat effect-ultra at 1125 words (78.6%). Haiku performs worse with long prompts.
- **Boundary wrapping is longest section**: It is the #1 failure mode. Two patterns shown (runSync+try/catch and runSyncExit) to cover both simple and custom-error-class cases.
- **Specific, not vague**: "check every export name" not "review your code". Concrete examples prevent common failures.
- **Context bundles included**: errors.md and common-pitfalls.md provide Effect-specific knowledge that complements the pipeline.

## Comparison Targets

- effect-critic/v2: 86.5% L2, 75.0% HARD pass rate
- ultra-ts/v2: 80.0% L2, 93.3% HARD pass rate
- effect-pbt/v2: 83.3% L2, 58.0% HARD pass rate
