<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-03 | Updated: 2026-04-03 -->

# BL-1 — Mandate Pricing Engine

## Purpose
First business logic benchmark task. Implements a car sales mandate pricing engine (from VroomMarket domain): given a net seller price and commission rate, calculates the displayed price, vendor share, and commission share. Includes batch pricing with precise accumulation.

## Key Files

| File | Description |
|------|-------------|
| `spec.md` | Full specification — formulas, constraints, invariants, interface definitions, and 4 bugs to seed |
| `pricing.ts` | Ground truth implementation — `calculatePricing`, `validatePrixTarget`, `calculateBatchPricing` |
| `pricing.test.ts` | Reference tests validating the correct implementation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `bugs/` | Four seeded bug variants and their verification tests (see `bugs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- The core formula is: `prixAffiche = prixNetVendeur / (1 - commissionRate)`
- All monetary values use `roundCents()` — `Math.round((value + Number.EPSILON) * 100) / 100`
- Input validation: `prixNetVendeur > 0`, `commissionRate ∈ [0, 1)`
- `PricingError` is the custom error class for all validation failures

### Key Invariants (from spec.md)
1. `vendorShare + commissionShare === prixAffiche` (parts sum to whole)
2. `prixAffiche >= prixNetVendeur` (commission only increases price)
3. All outputs positive/non-negative for valid inputs
4. Higher commission rate → higher prixAffiche (monotonicity)
5. Zero commission → prixAffiche equals prixNetVendeur

### Testing Requirements
- `pricing.test.ts` must pass against `pricing.ts`
- Bug verification tests in `bugs/` must demonstrate each bug breaks at least one invariant

### Common Patterns
- Per-item rounding in batch accumulation prevents floating-point drift
- Batch delegates to `calculatePricing` per item — single source of truth for the formula

## Dependencies

### Internal
- No imports from `@infra` — self-contained reference implementation

### External
- `vitest` — Test runner

<!-- MANUAL: -->
