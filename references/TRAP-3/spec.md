# TRAP-3: Portfolio Optimizer

## Overview
Implement a portfolio optimization function that allocates capital across a set of assets given various risk constraints, sector limits, and rebalancing costs.

## Exported API

```ts
export interface Asset {
  /** Unique identifier */
  id: string;
  /** Expected annual return (e.g. 0.12 = 12%) */
  expectedReturn: number;
  /** Annual volatility / standard deviation (e.g. 0.20 = 20%) */
  volatility: number;
  /** Sector classification */
  sector: string;
  /** Current portfolio weight (0..1), used for rebalancing cost calculation */
  currentWeight: number;
}

export interface Constraints {
  /** Maximum weight for any single asset (0..1). 1.0 means no per-asset limit. */
  maxWeight: number;
  /** Maximum total weight for any single sector (0..1). 1.0 means no sector limit. */
  sectorLimit: number;
  /** Risk budget: maximum portfolio volatility allowed (0..1). 1.0 means no risk limit. */
  maxPortfolioVolatility: number;
  /** Proportional cost of rebalancing (applied to weight change). 0 means no cost. */
  rebalancingCost: number;
  /** Minimum weight for any included asset. Assets below this threshold get 0. */
  minWeight: number;
  /**
   * Correlation matrix between assets, keyed by "assetId1:assetId2".
   * If missing for a pair, assume correlation = 0.
   * Used for portfolio volatility calculation.
   */
  correlations: Record<string, number>;
}

export interface Allocation {
  assetId: string;
  weight: number;
}

export function optimizePortfolio(assets: Asset[], constraints: Constraints): Allocation[];
```

## Detailed Requirements

### Objective
Maximize net expected return:
```
netReturn = sum(weight_i * expectedReturn_i) - rebalancingCost * sum(|weight_i - currentWeight_i|)
```

### Portfolio Volatility Calculation
```
portfolioVariance = sum_i(sum_j(w_i * w_j * vol_i * vol_j * corr(i,j)))
```
Where `corr(i,i) = 1` and `corr(i,j)` is looked up from `constraints.correlations` using the key `"id1:id2"` where id1 < id2 lexicographically. If not found, assume 0.

`portfolioVolatility = sqrt(portfolioVariance)`

### Constraints Applied
1. **Weight bounds**: Each asset's weight must be in `[0, maxWeight]`.
2. **Sector limits**: Sum of weights for assets in any sector must be <= `sectorLimit`.
3. **Risk constraint**: `portfolioVolatility <= maxPortfolioVolatility`.
4. **Minimum weight**: If an asset's optimal weight would be < `minWeight`, set it to 0 instead.
5. **Budget constraint**: Weights must sum to exactly 1.0.

### Algorithm
The implementation should find the allocation that maximizes net expected return subject to all constraints. Given the complexity, a reasonable heuristic or greedy approach is acceptable:

1. Compute the "adjusted return" for each asset: `expectedReturn - rebalancingCost * |1 - currentWeight|` (cost of moving to 100% from current).
2. Sort assets by adjusted return, descending.
3. Greedily allocate to the highest-return assets, respecting maxWeight, sectorLimit, and minWeight.
4. If no allocation is feasible (constraints too tight), return an empty array.
5. Normalize weights to sum to 1.0.

### Validation
- `assets` must be non-empty. Throw `Error("No assets provided")` if empty.
- `maxWeight` must be in (0, 1]. Throw `Error("Invalid maxWeight")` otherwise.
- `sectorLimit` must be in (0, 1]. Throw `Error("Invalid sectorLimit")` otherwise.
- All asset `expectedReturn` values must be finite numbers.

### Output
- Return only assets with weight > 0.
- Sort output by `weight` descending, then by `assetId` ascending for ties.
- Weights should be rounded to 6 decimal places.

## Invariants
1. All weights are in [0, 1].
2. Weights sum to 1.0 (within floating-point tolerance of 1e-9).
3. No sector exceeds its limit.
4. Portfolio volatility does not exceed maxPortfolioVolatility.
5. No asset has weight in (0, minWeight) — either >= minWeight or exactly 0.
