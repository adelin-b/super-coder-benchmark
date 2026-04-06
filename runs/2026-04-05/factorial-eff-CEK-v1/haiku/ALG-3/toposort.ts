export interface ToposortResult {
  sorted: string[];
  cycle: string[] | null;
}

export function toposort(edges: Array<[string, string]>): ToposortResult {
  if (edges.length === 0) {
    return { sorted: [], cycle: null };
  }

  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodes = new Set<string>();

  // Build adjacency list and calculate in-degrees
  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);

    if (!graph.has(from)) {
      graph.set(from, []);
    }
    graph.get(from)!.push(to);

    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  // Initialize in-degrees for all nodes
  for (const node of nodes) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
  }

  // Kahn's algorithm (BFS-based topological sort)
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];
  const inDegreeCopy = new Map(inDegree);

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      inDegreeCopy.set(neighbor, inDegreeCopy.get(neighbor)! - 1);
      if (inDegreeCopy.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycle: if not all nodes were sorted, there's a cycle
  if (sorted.length !== nodes.size) {
    const cycle = findCycleDFS(graph, nodes);
    return { sorted: [], cycle };
  }

  return { sorted, cycle: null };
}

function findCycleDFS(
  graph: Map<string, string[]>,
  nodes: Set<string>
): string[] {
  const color = new Map<string, 0 | 1 | 2>(); // 0: white, 1: gray, 2: black
  const path: string[] = [];

  for (const node of nodes) {
    color.set(node, 0);
  }

  function dfs(node: string): string[] | null {
    color.set(node, 1);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const nodeColor = color.get(neighbor);

      if (nodeColor === 1) {
        // Back edge found - cycle detected
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }

      if (nodeColor === 0) {
        const result = dfs(neighbor);
        if (result) {
          return result;
        }
      }
    }

    path.pop();
    color.set(node, 2);
    return null;
  }

  for (const node of nodes) {
    if (color.get(node) === 0) {
      const result = dfs(node);
      if (result) {
        return result;
      }
    }
  }

  return [];
}