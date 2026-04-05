/** BUG: Self-loops don't increment in-degree twice (or at all), so self-loops aren't detected as cycles */
export class CycleError extends Error { constructor(m: string) { super(m); this.name = 'CycleError'; } }

export function topoSort(nodes: string[], edges: [string, string][]): string[] {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) { adj.set(n, []); inDeg.set(n, 0); }
  for (const [u, v] of edges) {
    if (!adj.has(u) || !adj.has(v)) throw new Error(`Unknown node`);
    if (u === v) continue; // BUG: skips self-loops
    adj.get(u)!.push(v);
    inDeg.set(v, (inDeg.get(v) ?? 0) + 1);
  }
  const queue = nodes.filter(n => inDeg.get(n) === 0);
  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj.get(node)!) {
      inDeg.set(neighbor, inDeg.get(neighbor)! - 1);
      if (inDeg.get(neighbor) === 0) queue.push(neighbor);
    }
  }
  if (result.length !== nodes.length) throw new CycleError('Graph has a cycle');
  return result;
}
