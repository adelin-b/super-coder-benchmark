interface Rate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

interface ConversionResult {
  amount: number;
  rate: number;
  path: string[];
}

function createConverter(rates: Rate[], maxAgeMs?: number) {
  const rateMap = new Map<string, Rate>();
  const graph = new Map<string, Set<string>>();

  const addRateToGraph = (rate: Rate) => {
    const key = `${rate.from}_${rate.to}`;
    rateMap.set(key, rate);

    if (!graph.has(rate.from)) {
      graph.set(rate.from, new Set());
    }
    graph.get(rate.from)!.add(rate.to);

    // Add inverse rate
    const inverseKey = `${rate.to}_${rate.from}`;
    rateMap.set(inverseKey, {
      from: rate.to,
      to: rate.from,
      rate: 1 / rate.rate,
      timestamp: rate.timestamp,
    });

    if (!graph.has(rate.to)) {
      graph.set(rate.to, new Set());
    }
    graph.get(rate.to)!.add(rate.from);
  };

  rates.forEach(addRateToGraph);

  const isStale = (rate: Rate): boolean => {
    if (maxAgeMs === undefined) return false;
    return Date.now() - rate.timestamp > maxAgeMs;
  };

  const findPath = (from: string, to: string): string[] | null => {
    if (from === to) return [from];

    const queue: Array<{ currency: string; path: string[] }> = [
      { currency: from, path: [from] },
    ];
    const visited = new Set<string>();
    visited.add(from);

    while (queue.length > 0) {
      const { currency, path } = queue.shift()!;
      const neighbors = graph.get(currency) || new Set();

      for (const neighbor of neighbors) {
        if (neighbor === to) {
          return [...path, to];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ currency: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null;
  };

  return {
    convert(amount: number, from: string, to: string): ConversionResult {
      if (from === to) {
        return {
          amount: Math.round(amount * 100) / 100,
          rate: 1,
          path: [from],
        };
      }

      const path = findPath(from, to);
      if (!path) {
        throw new Error(`No conversion path found from ${from} to ${to}`);
      }

      let rate = 1;
      for (let i = 0; i < path.length - 1; i++) {
        const key = `${path[i]}_${path[i + 1]}`;
        const rateObj = rateMap.get(key);

        if (!rateObj || isStale(rateObj)) {
          throw new Error(
            `Stale or missing rate from ${path[i]} to ${path[i + 1]}`
          );
        }

        rate *= rateObj.rate;
      }

      const convertedAmount = Math.round(amount * rate * 100) / 100;

      return {
        amount: convertedAmount,
        rate,
        path,
      };
    },

    addRate(rate: Rate): void {
      addRateToGraph(rate);
    },
  };
}

export { Rate, ConversionResult, createConverter };