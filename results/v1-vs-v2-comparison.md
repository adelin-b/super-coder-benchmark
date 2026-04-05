# Effect-TS v1 vs v2 Comparison

**Date:** 2026-04-06  
**Runner:** `infra/agent-runner.mts`  
**Total wall time:** ~1055 seconds (~17.6 minutes)  
**Total tokens consumed:** 105,149 (68 input, 105,081 output)

## Summary Table

| Task | Model | v1 Tests | v1 Rate | v2 Tests | v2 Rate | Delta | Verdict |
|------|-------|----------|---------|----------|---------|-------|---------|
| BL-1 | haiku | 18/19 | 94.74% | 18/19 | 94.74% | +0% | same |
| BL-5 | haiku | 0/1 | 0% | 0/1 | 0% | +0% | same |
| SAAS-3 | haiku | 0/1 | 0% | 0/1 | 0% | +0% | same |
| BL-1 | sonnet | 18/19 | 94.74% | 18/19 | 94.74% | +0% | same |
| BL-5 | sonnet | 0/1 | 0% | 0/1 | 0% | +0% | same |
| SAAS-3 | sonnet | 0/1 | 0% | 0/1 | 0% | +0% | same |

### Notes on 0/1 results

BL-5 and SAAS-3 show 0/1 because the generated code failed to compile (import/type errors), causing vitest to report 1 failed test suite with 0 individual tests passing. Both v1 and v2 produce Effect-TS code that uses `Effect.*` APIs not available in the test harness's plain-TypeScript environment, making these tasks structurally incompatible with the effect-ts agent approach in single-shot mode.

## Token Efficiency

| Task | Model | v1 Tokens Out | v2 Tokens Out | v2 vs v1 |
|------|-------|--------------|--------------|----------|
| BL-1 | haiku | 2,100 | 1,959 | -6.7% |
| BL-5 | haiku | 4,110 | 3,717 | -9.6% |
| SAAS-3 | haiku | 4,256 | 3,028 | -28.8% |
| BL-1 | sonnet | 651 | 1,227 | +88.5% |
| BL-5 | sonnet | 24,230 | 20,843 | -14.0% |
| SAAS-3 | sonnet | 36,533 | 2,427 | -93.4% |

## Hypothesis H1 Validation

**H1:** effect-ts/v2 (+ Effect docs bundle) will outperform v1 on L2-hard tasks due to FiberFailure documentation preventing wrapping confusion.

**Result: FALSIFIED** -- v2 showed zero improvement over v1 on any task/model combination. Both versions achieved identical pass rates across all 6 task-model pairs. The Effect documentation context bundle added in v2 (errors.md, generators.md, common-pitfalls.md, xstate-v5 primer) did not translate into better test outcomes.

The core failure mode is not FiberFailure wrapping confusion but rather a fundamental mismatch: the effect-ts agent produces code using Effect-TS APIs (Effect.succeed, Effect.fail, pipe, etc.) but the test harnesses expect plain TypeScript functions with standard return types. The generated code cannot compile against the test files, regardless of how well the model understands Effect-TS patterns.

## Key Observations

- **BL-1 is the only viable task:** Both v1 and v2 achieve 18/19 (94.74%) on BL-1 across both models, suggesting the pricing task is simple enough that the Effect-TS wrapping still produces compatible exports.
- **BL-5 and SAAS-3 are structural failures:** The 0/1 result indicates compilation failure, not logic errors. The effect-ts agent paradigm fundamentally conflicts with the test harness expectations for these complex tasks.
- **v2 is more token-efficient with haiku:** v2 used fewer output tokens on all 3 haiku tasks (-6.7% to -28.8%), suggesting the context bundle helps the model be more concise.
- **Sonnet SAAS-3 v1 is anomalous:** v1-sonnet on SAAS-3 consumed 36,533 tokens and took 404 seconds, vastly more than any other run. v2-sonnet on the same task used only 2,427 tokens (93% reduction), suggesting the context bundle may help sonnet avoid rambling on impossible tasks.
- **Model tier had no effect on outcomes:** haiku and sonnet produced identical pass/fail patterns, indicating the bottleneck is the agent design (Effect-TS output), not model capability.
