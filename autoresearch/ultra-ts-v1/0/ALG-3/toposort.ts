export function toposort(nodes: string[], edges: Array<[string, string]>): string[] {
  if (nodes.length === 0) return [];

  // Build adjacency list
  const graph = new Map<string, string[]>();
  for (const node of nodes) {
    graph.set(node, []);
  }

  for (const [from, to] of edges) {
    if (!graph.has(from)) throw new Error(`Node ${from} not found`);
    if (!graph.has(to)) throw new Error(`Node ${to} not found`);
    graph.get(from)!.push(to);
  }

  // Colors for cycle detection: white (unvisited), gray (visiting), black (finished)
  const colors = new Map<string, 'white' | 'gray' | 'black'>();
  for (const node of nodes) {
    colors.set(node, 'white');
  }

  const stack: string[] = [];

  function dfs(node: string): void {
    colors.set(node, 'gray');

    for (const neighbor of graph.get(node)!) {
      const color = colors.get(neighbor);

      if (color === 'gray') {
        throw new Error('Cycle detected in graph');
      }

      if (color === 'white') {
        dfs(neighbor);
      }
    }

    colors.set(node, 'black');
    stack.push(node);
  }

  for (const node of nodes) {
    if (colors.get(node) === 'white') {
      dfs(node);
    }
  }

  return stack.reverse();
}