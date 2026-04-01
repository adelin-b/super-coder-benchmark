# BL-3: Currency Converter with Rates

## Spec
Convert between currencies using a rate table. Support inverse rates, transitive conversion (A→B→C), and staleness detection.

## Interface
```typescript
interface Rate { from: string; to: string; rate: number; timestamp: number; }
interface ConversionResult { amount: number; rate: number; path: string[]; }
function createConverter(rates: Rate[], maxAgeMs?: number): {
  convert(amount: number, from: string, to: string): ConversionResult;
  addRate(rate: Rate): void;
};
```

## Invariants
1. convert(convert(x, A, B).amount, B, A).amount ≈ x (round-trip)
2. Same currency → rate = 1, amount unchanged
3. Stale rates rejected if maxAgeMs set
4. All amounts rounded to 2 decimal places
