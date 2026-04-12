<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-03 | Updated: 2026-04-03 -->

# BL-1 Bugs — Seeded Bug Variants

## Purpose
Contains four intentionally buggy variants of the BL-1 pricing engine, each targeting a specific class of defect. These are used to measure how well each verification method detects real bugs. A verification test file proves each bug is detectable.

## Key Files

| File | Description |
|------|-------------|
| `bug-verification.test.ts` | Tests that run against each buggy variant to prove the bugs break invariants |
| `bug1-percentage-off-by-one.ts` | Uses `prixNetVendeur * (1 + rate)` instead of `/ (1 - rate)` — wrong formula |
| `bug2-division-by-zero.ts` | Missing guard for `commissionRate === 1.0` — causes division by zero crash |
| `bug3-negative-price.ts` | Missing guard for `commissionRate > 1.0` — produces negative displayed price |
| `bug4-floating-point-accumulation.ts` | Naive batch summation without per-step rounding — accumulated floating-point error |

## For AI Agents

### Working In This Directory
- Each bug file exports the same interface as `../pricing.ts` — they are drop-in replacements with one defect
- Bug 1 tests formula correctness (mathematical accuracy)
- Bug 2 tests boundary handling (edge case at rate=1.0)
- Bug 3 tests input validation (rate > 1.0 should be rejected)
- Bug 4 tests numerical precision (batch accumulation drift)

### Testing Requirements
- `bug-verification.test.ts` must FAIL for each bug variant — this proves the bug is detectable
- Each bug should break at least one invariant from `spec.md`
- If adding a new bug: create `bug{N}-{descriptive-name}.ts`, add test cases to verification file

### Bug Design Principles
- Each bug must be subtle enough that naive tests might miss it
- Each bug must be detectable by at least one verification method
- Bugs should cover different defect classes: logic errors, boundary failures, validation gaps, precision issues

## Dependencies

### Internal
- Each bug file mirrors `../pricing.ts` interface (PricingResult, PricingError, calculatePricing, etc.)
- `bug-verification.test.ts` imports from each bug file

### External
- `vitest` — Test runner

<!-- MANUAL: -->
