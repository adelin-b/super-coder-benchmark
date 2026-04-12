export class CycleError extends Error {
  constructor(message = 'Graph contains a cycle') {
    super(message);
    this.name = 'CycleError';
  }
}

export function topoSort(nodes: string[], edges: [string, string][]): string[] {
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    adjList.set(node, []);
  }
  for (const [u, v] of edges) {
    adjList.get(u)!.push(v);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node, WHITE);

  const result: string[] = [];

  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of adjList.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) throw new CycleError();
      if (c === WHITE) dfs(v);
    }
    color.set(u, BLACK);
    result.push(u);
  }

  for (const node of nodes) {
    if (color.get(node) === WHITE) dfs(node);
  }

  return result.reverse();
}