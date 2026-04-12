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

function getCorrelation(
  correlations: Record<string, number>,
  id1: string,
  id2: string
): number {
  if (id1 === id2) return 1;
  const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
  return correlations[key] ?? 0;
}

function computePortfolioVolatility(
  active: Array<{ id: string; weight: number; volatility: number }>,
  correlations: Record<string, number>
): number {
  let variance = 0;
  for (let i = 0; i < active.length; i++) {
    for (let j = 0; j < active.length; j++) {
      const ai = active[i];
      const aj = active[j];
      const corr = getCorrelation(correlations, ai.id, aj.id);
      variance += ai.weight * aj.weight * ai.volatility * aj.volatility * corr;
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

function normalizeWeights(
  items: Array<{ id: string; weight: number; volatility: number; sector: string }>
): Array<{ id: string; weight: number; volatility: number; sector: string }> {
  const total = items.reduce((s, a) => s + a.weight, 0);
  if (total < 1e-12) return [];
  return items.map((a) => ({ ...a, weight: a.weight / total }));
}

export function optimizePortfolio(
  assets: Asset[],
  constraints: Constraints
): Allocation[] {
  // --- Validation ---
  if (assets.length === 0) throw new Error("No assets provided");
  if (constraints.maxWeight <= 0 || constraints.maxWeight > 1)
    throw new Error("Invalid maxWeight");
  if (constraints.sectorLimit <= 0 || constraints.sectorLimit > 1)
    throw new Error("Invalid sectorLimit");
  for (const asset of assets) {
    if (!isFinite(asset.expectedReturn)) {
      throw new Error(
        `Asset ${asset.id} has non-finite expectedReturn`
      );
    }
  }

  const {
    maxWeight,
    sectorLimit,
    maxPortfolioVolatility,
    rebalancingCost,
    minWeight,
    correlations,
  } = constraints;

  // --- Step 1 & 2: Compute adjusted returns and sort descending ---
  const sorted = [...assets].sort((a, b) => {
    const adjA =
      a.expectedReturn - rebalancingCost * Math.abs(1 - a.currentWeight);
    const adjB =
      b.expectedReturn - rebalancingCost * Math.abs(1 - b.currentWeight);
    return adjB - adjA;
  });

  // --- Step 3: Greedy allocation ---
  const allocMap = new Map<string, number>();
  const sectorUsed = new Map<string, number>();
  let remaining = 1.0;

  for (const asset of sorted) {
    if (remaining < 1e-12) break;
    const secUsed = sectorUsed.get(asset.sector) ?? 0;
    const secAvail = sectorLimit - secUsed;
    if (secAvail < 1e-12) continue;

    const available = Math.min(maxWeight, remaining, secAvail);

    // Skip if we cannot meet minimum weight threshold
    if (available < minWeight && minWeight > 0) continue;
    if (available <= 1e-12) continue;

    allocMap.set(asset.id, available);
    sectorUsed.set(asset.sector, secUsed + available);
    remaining -= available;
  }

  // --- Step 4: Check feasibility ---
  if (allocMap.size === 0) return [];

  const rawTotal = Array.from(allocMap.values()).reduce((s, w) => s + w, 0);
  if (rawTotal < 1e-12) return [];

  // --- Step 5: Normalize to 1.0 ---
  let active: Array<{
    id: string;
    weight: number;
    volatility: number;
    sector: string;
  }> = sorted
    .filter((a) => allocMap.has(a.id))
    .map((a) => ({
      id: a.id,
      weight: (allocMap.get(a.id) ?? 0) / rawTotal,
      volatility: a.volatility,
      sector: a.sector,
    }));

  // --- Apply minWeight filter post-normalization ---
  // Normalization scales weights up (total <= 1), so minWeight preserved;
  // but run one pass to be safe
  {
    const before = active.length;
    active = active.filter(
      (a) => a.weight >= minWeight || a.weight <= 1e-12
    );
    active = active.filter((a) => a.weight > 1e-12);
    if (active.length < before) {
      active = normalizeWeights(active);
      // Re-check minWeight after re-normalization
      active = active.filter((a) => a.weight >= minWeight);
      active = normalizeWeights(active);
    }
  }

  if (active.length === 0) return [];

  // --- Sector constraint enforcement post-normalization ---
  // When budget is under-filled, normalizing can push sector totals above limit.
  // Iteratively scale down offending sectors and re-normalize.
  const MAX_FIX_ITERS = assets.length * 2 + 10;
  for (let iter = 0; iter < MAX_FIX_ITERS; iter++) {
    const sectorTotals = new Map<string, number>();
    for (const a of active) {
      sectorTotals.set(a.sector, (sectorTotals.get(a.sector) ?? 0) + a.weight);
    }

    let violated = false;
    for (const [sector, sw] of sectorTotals) {
      if (sw > sectorLimit + 1e-9) {
        violated = true;
        const scale = sectorLimit / sw;
        active = active.map((a) =>
          a.sector === sector ? { ...a, weight: a.weight * scale } : a
        );
        // Remove those that fell below minWeight
        active = active.filter(
          (a) => a.weight >= minWeight || a.sector !== sector
        );
        active = active.filter((a) => a.weight > 1e-12);
        if (active.length === 0) return [];
        active = normalizeWeights(active);
        if (active.length === 0) return [];
        break; // restart loop after fixing one sector
      }
    }

    if (!violated) break;
  }

  if (active.length === 0) return [];

  // --- Risk constraint: iteratively remove highest-volatility assets ---
  for (let iter = 0; iter < assets.length; iter++) {
    if (active.length === 0) return [];

    const vol = computePortfolioVolatility(active, correlations);
    if (vol <= maxPortfolioVolatility + 1e-9) break;

    // Remove the asset with the highest individual volatility
    active.sort((a, b) => b.volatility - a.volatility);
    active.shift();

    if (active.length === 0) return [];

    // Re-normalize
    active = normalizeWeights(active);
    if (active.length === 0) return [];

    // Re-apply minWeight filter
    active = active.filter((a) => a.weight >= minWeight);
    if (active.length === 0) return [];
    active = normalizeWeights(active);
    if (active.length === 0) return [];
  }

  if (active.length === 0) return [];

  // Final risk check
  const finalVol = computePortfolioVolatility(active, correlations);
  if (finalVol > maxPortfolioVolatility + 1e-9) return [];

  // --- Build output ---
  const result: Allocation[] = active
    .filter((a) => a.weight > 1e-12)
    .map((a) => ({
      assetId: a.id,
      weight: Math.round(a.weight * 1_000_000) / 1_000_000,
    }))
    .filter((a) => a.weight > 0);

  // Sort: weight descending, then assetId ascending for ties
  result.sort((a, b) => {
    const diff = b.weight - a.weight;
    if (Math.abs(diff) > 1e-9) return diff;
    return a.assetId.localeCompare(b.assetId);
  });

  return result;
}