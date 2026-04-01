import { describe, it, expect } from 'vitest';
import { createConverter, ConverterError } from './converter.js';

const now = Date.now();
const rates = [
  { from: 'USD', to: 'EUR', rate: 0.85, timestamp: now },
  { from: 'EUR', to: 'GBP', rate: 0.86, timestamp: now },
  { from: 'USD', to: 'JPY', rate: 110.0, timestamp: now },
];

describe('BL-3: Currency Converter', () => {
  it('direct conversion', () => {
    const c = createConverter(rates);
    expect(c.convert(100, 'USD', 'EUR').amount).toBe(85);
  });
  it('inverse conversion', () => {
    const c = createConverter(rates);
    const r = c.convert(85, 'EUR', 'USD');
    expect(r.amount).toBe(100);
  });
  it('same currency', () => {
    const c = createConverter(rates);
    expect(c.convert(100, 'USD', 'USD').amount).toBe(100);
  });
  it('transitive: USD→EUR→GBP', () => {
    const c = createConverter(rates);
    const r = c.convert(100, 'USD', 'GBP');
    expect(r.path).toEqual(['USD', 'EUR', 'GBP']);
    expect(r.amount).toBe(73.1); // 100 * 0.85 * 0.86
  });
  it('round-trip ≈ original', () => {
    const c = createConverter(rates);
    const toEur = c.convert(100, 'USD', 'EUR').amount;
    const back = c.convert(toEur, 'EUR', 'USD').amount;
    expect(back).toBeCloseTo(100, 0);
  });
  it('throws on no path', () => {
    const c = createConverter(rates);
    expect(() => c.convert(100, 'USD', 'CHF')).toThrow(ConverterError);
  });
  it('throws on negative amount', () => {
    const c = createConverter(rates);
    expect(() => c.convert(-10, 'USD', 'EUR')).toThrow(ConverterError);
  });
  it('stale rate rejected', () => {
    const stale = [{ from: 'USD', to: 'EUR', rate: 0.85, timestamp: now - 100000 }];
    const c = createConverter(stale, 1000);
    expect(() => c.convert(100, 'USD', 'EUR')).toThrow(ConverterError);
  });
});
