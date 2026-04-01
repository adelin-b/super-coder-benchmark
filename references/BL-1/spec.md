# BL-1: Mandate Pricing Engine

## Spec

Given `prixNetVendeur` (net seller price) and `commissionRate` (as a decimal, e.g. 0.05 for 5%), calculate:

1. **prixAffiche** (displayed price): `prixNetVendeur / (1 - commissionRate)`
2. **vendorShare**: the portion that goes to the vendor = `prixNetVendeur`
3. **commissionShare**: the portion that is commission = `prixAffiche - prixNetVendeur`
4. **validatePrixTarget(target, prixAffiche, tolerance)**: check if a target price falls within ±tolerance of the computed prixAffiche

## Constraints

- `prixNetVendeur` must be > 0
- `commissionRate` must be in [0, 1) — 0% to <100%
- All monetary outputs must be rounded to 2 decimal places (cents)
- For batch calculations: compute pricing for an array of mandates, sum totals

## Invariants (must hold for ALL valid inputs)

1. `vendorShare + commissionShare === prixAffiche` (parts sum to whole, to the cent)
2. `prixAffiche >= prixNetVendeur` (price always increases or stays same with commission)
3. `prixAffiche > 0`, `vendorShare > 0`, `commissionShare >= 0` (all outputs positive/non-negative for valid inputs)
4. Higher commission rate → higher prixAffiche (monotonicity)
5. `commissionRate === 0` → `prixAffiche === prixNetVendeur`

## Known Bugs to Seed

1. **percentage_off_by_one**: Use `prixNetVendeur * (1 + commissionRate)` instead of `prixNetVendeur / (1 - commissionRate)` — gives wrong result
2. **division_by_zero**: No guard when `commissionRate === 1.0` (100%) — should reject but crashes
3. **negative_price**: No guard when `commissionRate > 1.0` — produces negative displayed price
4. **floating_point_accumulation**: In batch mode, sum using naive addition instead of using precise rounding per-item — accumulated error over many items

## Interface

```typescript
interface PricingResult {
  prixAffiche: number;       // displayed price (rounded to 2 decimals)
  vendorShare: number;        // = prixNetVendeur
  commissionShare: number;    // = prixAffiche - prixNetVendeur
}

function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult;
function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean;
function calculateBatchPricing(mandates: Array<{ prixNetVendeur: number; commissionRate: number }>): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
};
```
