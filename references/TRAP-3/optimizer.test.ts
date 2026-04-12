import { describe, it, expect } from 'vitest';
import { optimizePortfolio, Asset, Constraints } from './optimizer.js';

describe('TRAP-3: Portfolio Optimizer (Irrelevant Context Pattern)', () => {
  // Helper: create constraints where everything is trivially unconstrained
  function trivialConstraints(overrides: Partial<Constraints> = {}): Constraints {
    return {
      maxWeight: 1.0,
      sectorLimit: 1.0,
      maxPortfolioVolatility: 1.0,
      rebalancingCost: 0,
      minWeight: 0,
      correlations: {},
      ...overrides,
    };
  }

  // --- THE TRAP: All constraints are vacuous, answer is always "100% in best asset" ---

  it('single asset gets 100% allocation', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 'tech', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe('A');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('100% in highest-return asset when no constraints bind', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.05, volatility: 0.30, sector: 'finance', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.15, volatility: 0.40, sector: 'tech', currentWeight: 0 },
      { id: 'C', expectedReturn: 0.10, volatility: 0.20, sector: 'health', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    // With no constraints, 100% in B (highest return)
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe('B');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('complex-looking assets but trivial constraints -> simple answer', () => {
    // 10 assets with varying volatilities, sectors, correlations — all irrelevant
    const assets: Asset[] = [
      { id: 'AAPL', expectedReturn: 0.12, volatility: 0.25, sector: 'tech', currentWeight: 0.1 },
      { id: 'GOOGL', expectedReturn: 0.11, volatility: 0.22, sector: 'tech', currentWeight: 0.1 },
      { id: 'JPM', expectedReturn: 0.08, volatility: 0.18, sector: 'finance', currentWeight: 0.1 },
      { id: 'JNJ', expectedReturn: 0.06, volatility: 0.12, sector: 'health', currentWeight: 0.1 },
      { id: 'TSLA', expectedReturn: 0.20, volatility: 0.50, sector: 'tech', currentWeight: 0.1 },
      { id: 'AMZN', expectedReturn: 0.14, volatility: 0.30, sector: 'tech', currentWeight: 0.1 },
      { id: 'XOM', expectedReturn: 0.07, volatility: 0.15, sector: 'energy', currentWeight: 0.1 },
      { id: 'PFE', expectedReturn: 0.05, volatility: 0.14, sector: 'health', currentWeight: 0.1 },
      { id: 'GS', expectedReturn: 0.09, volatility: 0.20, sector: 'finance', currentWeight: 0.1 },
      { id: 'NVDA', expectedReturn: 0.18, volatility: 0.45, sector: 'tech', currentWeight: 0.1 },
    ];
    const constraints = trivialConstraints({
      correlations: {
        'AAPL:GOOGL': 0.8,
        'AAPL:TSLA': 0.6,
        'GOOGL:TSLA': 0.5,
        'JPM:GS': 0.7,
        'JNJ:PFE': 0.6,
      },
    });
    const result = optimizePortfolio(assets, constraints);
    // TSLA has highest return (0.20) — 100% in TSLA
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe('TSLA');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('Sharpe ratios are irrelevant when all constraints are trivial', () => {
    // Asset A: low return but amazing Sharpe. Asset B: high return but bad Sharpe.
    // With trivial constraints, B wins because we maximize raw return.
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.05, volatility: 0.01, sector: 's1', currentWeight: 0 }, // Sharpe ~5
      { id: 'B', expectedReturn: 0.30, volatility: 0.90, sector: 's2', currentWeight: 0 }, // Sharpe ~0.33
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    expect(result[0].assetId).toBe('B');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('volatility does not matter when maxPortfolioVolatility is 1.0', () => {
    const assets: Asset[] = [
      { id: 'calm', expectedReturn: 0.08, volatility: 0.05, sector: 's', currentWeight: 0 },
      { id: 'wild', expectedReturn: 0.09, volatility: 0.95, sector: 's', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    expect(result[0].assetId).toBe('wild');
  });

  it('correlations are irrelevant when constraints do not bind', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.12, volatility: 0.20, sector: 's', currentWeight: 0 },
    ];
    const constraints = trivialConstraints({
      correlations: { 'A:B': 0.99 }, // Nearly perfectly correlated — does not matter
    });
    const result = optimizePortfolio(assets, constraints);
    expect(result[0].assetId).toBe('B');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('rebalancing cost of 0 means current weights are irrelevant', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's', currentWeight: 0.9 },
      { id: 'B', expectedReturn: 0.15, volatility: 0.30, sector: 's', currentWeight: 0.1 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints({ rebalancingCost: 0 }));
    expect(result[0].assetId).toBe('B');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  it('sector limit of 1.0 means sector diversification is irrelevant', () => {
    // All in same sector — doesn't matter when sectorLimit is 1.0
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.05, volatility: 0.10, sector: 'tech', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.15, volatility: 0.30, sector: 'tech', currentWeight: 0 },
      { id: 'C', expectedReturn: 0.10, volatility: 0.20, sector: 'tech', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    expect(result[0].assetId).toBe('B');
    expect(result[0].weight).toBeCloseTo(1.0, 5);
  });

  // --- With actual binding constraints ---

  it('maxWeight constraint forces diversification', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.20, volatility: 0.30, sector: 's1', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.15, volatility: 0.20, sector: 's2', currentWeight: 0 },
      { id: 'C', expectedReturn: 0.10, volatility: 0.10, sector: 's3', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints({ maxWeight: 0.5 }));
    // A gets 0.5, B gets 0.5, C gets 0
    expect(result.length).toBeGreaterThanOrEqual(2);
    const aAlloc = result.find(r => r.assetId === 'A');
    expect(aAlloc!.weight).toBeCloseTo(0.5, 5);
  });

  it('sectorLimit forces sector diversification', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.20, volatility: 0.30, sector: 'tech', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.18, volatility: 0.25, sector: 'tech', currentWeight: 0 },
      { id: 'C', expectedReturn: 0.10, volatility: 0.10, sector: 'health', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints({ sectorLimit: 0.6 }));
    // Tech capped at 0.6, so need health too
    const techWeight = result
      .filter(r => r.assetId === 'A' || r.assetId === 'B')
      .reduce((sum, r) => sum + r.weight, 0);
    expect(techWeight).toBeLessThanOrEqual(0.6 + 1e-6);
  });

  // --- Validation ---

  it('throws on empty assets array', () => {
    expect(() => optimizePortfolio([], trivialConstraints())).toThrow('No assets provided');
  });

  it('throws on maxWeight = 0', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's', currentWeight: 0 },
    ];
    expect(() => optimizePortfolio(assets, trivialConstraints({ maxWeight: 0 }))).toThrow('Invalid maxWeight');
  });

  it('throws on sectorLimit = 0', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's', currentWeight: 0 },
    ];
    expect(() => optimizePortfolio(assets, trivialConstraints({ sectorLimit: 0 }))).toThrow('Invalid sectorLimit');
  });

  it('weights sum to 1.0', () => {
    const assets: Asset[] = [
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's1', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.15, volatility: 0.30, sector: 's2', currentWeight: 0 },
      { id: 'C', expectedReturn: 0.12, volatility: 0.25, sector: 's3', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints());
    const sum = result.reduce((s, r) => s + r.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('output sorted by weight desc, then assetId asc', () => {
    const assets: Asset[] = [
      { id: 'C', expectedReturn: 0.10, volatility: 0.20, sector: 's1', currentWeight: 0 },
      { id: 'A', expectedReturn: 0.10, volatility: 0.20, sector: 's2', currentWeight: 0 },
      { id: 'B', expectedReturn: 0.10, volatility: 0.20, sector: 's3', currentWeight: 0 },
    ];
    const result = optimizePortfolio(assets, trivialConstraints({ maxWeight: 0.4 }));
    // With maxWeight=0.4 and all equal returns: first gets 0.4, second gets 0.4, third gets 0.2
    // Equal weights should be sorted by assetId
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].weight === result[i + 1].weight) {
        expect(result[i].assetId < result[i + 1].assetId).toBe(true);
      } else {
        expect(result[i].weight).toBeGreaterThan(result[i + 1].weight);
      }
    }
  });
});
