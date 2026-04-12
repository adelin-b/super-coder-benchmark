export interface Asset {
  id: string;
  expectedReturn: number;
  volatility: number;
  sector: string;
  currentWeight: number;
}

export interface Constraints {
  maxWeight: number;
  sectorLimit: number;
  maxPortfolioVolatility: number;
  rebalancingCost: number;
  minWeight: number;
  correlations: Record<string, number>;
}

export interface Allocation {
  assetId: string;
  weight: number;
}

export function optimizePortfolio(assets: Asset[], constraints: Constraints): Allocation[] {
  // Validation
  if (assets.length === 0) {
    throw new Error('No assets provided');
  }
  if (constraints.maxWeight <= 0 || constraints.maxWeight > 1) {
    throw new Error('Invalid maxWeight');
  }
  if (constraints.sectorLimit <= 0 || constraints.sectorLimit > 1) {
    throw new Error('Invalid sectorLimit');
  }
  for (const asset of assets) {
    if (!Number.isFinite(asset.expectedReturn)) {
      throw new Error('Invalid expectedReturn');
    }
  }

  const { maxWeight, sectorLimit, rebalancingCost, minWeight } = constraints;

  // Compute adjusted return for each asset
  const adjusted = assets.map(a => ({
    asset: a,
    adjustedReturn: a.expectedReturn - rebalancingCost * Math.abs(1 - a.currentWeight),
  }));

  // Sort by adjusted return descending
  adjusted.sort((a, b) => b.adjustedReturn - a.adjustedReturn);

  // Greedy allocation
  const sectorWeights = new Map<string, number>();
  const allocations: { assetId: string; weight: number }[] = [];
  let totalAllocated = 0;

  for (const { asset } of adjusted) {
    const currentSectorWeight = sectorWeights.get(asset.sector) || 0;
    const sectorRoom = sectorLimit - currentSectorWeight;
    const assetRoom = maxWeight;
    const budgetRoom = 1 - totalAllocated;

    let weight = Math.min(assetRoom, sectorRoom, budgetRoom);

    if (weight < minWeight) {
      weight = 0;
    }

    if (weight > 0) {
      allocations.push({ assetId: asset.id, weight });
      totalAllocated += weight;
      sectorWeights.set(asset.sector, currentSectorWeight + weight);
    }

    if (Math.abs(totalAllocated - 1) < 1e-12) break;
  }

  if (allocations.length === 0) return [];

  // Normalize to sum to 1.0
  if (totalAllocated > 0 && Math.abs(totalAllocated - 1) > 1e-12) {
    const scale = 1 / totalAllocated;
    for (const a of allocations) {
      a.weight *= scale;
    }
  }

  // Apply minWeight check after normalization
  const filtered = allocations.filter(a => a.weight >= minWeight || minWeight === 0);
  if (filtered.length === 0) return [];

  // Re-normalize if we filtered any out
  if (filtered.length < allocations.length) {
    const sum = filtered.reduce((s, a) => s + a.weight, 0);
    if (sum > 0) {
      const scale = 1 / sum;
      for (const a of filtered) {
        a.weight *= scale;
      }
    }
  }

  // Round to 6 decimal places
  for (const a of filtered) {
    a.weight = Math.round(a.weight * 1e6) / 1e6;
  }

  // Fix rounding to ensure sum = 1.0
  const sum = filtered.reduce((s, a) => s + a.weight, 0);
  if (filtered.length > 0 && Math.abs(sum - 1) > 1e-9) {
    filtered[0].weight += 1 - sum;
    filtered[0].weight = Math.round(filtered[0].weight * 1e6) / 1e6;
  }

  // Sort by weight desc, then assetId asc
  filtered.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.assetId.localeCompare(b.assetId);
  });

  return filtered;
}
