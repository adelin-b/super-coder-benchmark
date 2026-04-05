/** BUG: Stale rates not rejected even when maxAgeMs set */
export interface Rate { from: string; to: string; rate: number; timestamp: number; }
export interface ConversionResult { amount: number; rate: number; path: string[]; }
export class ConverterError extends Error { constructor(m: string) { super(m); this.name = 'ConverterError'; } }
function r2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function createConverter(rates: Rate[], maxAgeMs?: number) {
  const rateMap = new Map<string, Rate>();
  const addRate = (rate: Rate) => {
    if (rate.rate <= 0) throw new ConverterError('Rate must be positive');
    rateMap.set(`${rate.from}->${rate.to}`, rate);
    rateMap.set(`${rate.to}->${rate.from}`, { from: rate.to, to: rate.from, rate: 1 / rate.rate, timestamp: rate.timestamp });
  };
  rates.forEach(addRate);

  function findPath(from: string, to: string, visited = new Set<string>()): { rate: number; path: string[] } | null {
    if (from === to) return { rate: 1, path: [from] };
    visited.add(from);
    const direct = rateMap.get(`${from}->${to}`);
    if (direct) {
      // BUG: no staleness check
      return { rate: direct.rate, path: [from, to] };
    }
    for (const [key, r] of rateMap) {
      if (key.startsWith(`${from}->`) && !visited.has(r.to)) {
        const sub = findPath(r.to, to, visited);
        if (sub) return { rate: r.rate * sub.rate, path: [from, ...sub.path] };
      }
    }
    return null;
  }

  return {
    convert(amount: number, from: string, to: string): ConversionResult {
      if (amount < 0) throw new ConverterError('Amount must be non-negative');
      const result = findPath(from, to);
      if (!result) throw new ConverterError(`No conversion path: ${from} → ${to}`);
      return { amount: r2(amount * result.rate), rate: r2(result.rate), path: result.path };
    },
    addRate,
  };
}
