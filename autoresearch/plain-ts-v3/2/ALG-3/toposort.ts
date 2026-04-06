type Node = string | number;
type Edge = [Node, Node];

export class CycleDetectedError extends Error {
  constructor(message: string = 'Cycle detected in graph') {
    super(message);
    this.name = 'CycleDetectedError';
  }
}

export function toposort(edges: Edge[]): Node[] {
  const graph = new Map<Node, Set<Node>>();
  const inDegree = new Map<Node, number>();
  const nodes = new Set<Node>();

  // Initialize graph
  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);

    if (!graph.has(from)) {
      graph.set(from, new Set());
      inDegree.set(from, 0);
    }
    if (!inDegree.has(to)) {
      inDegree.set(to, 0);
    }

    if (!graph.get(from)!.has(to)) {
      graph.get(from)!.add(to);
      inDegree.set(to, inDegree.get(to)! + 1);
    }
  }

  // Kahn's algorithm
  const queue: Node[] = [];
  for (const node of nodes) {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  }

  const result: Node[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of graph.get(node) || []) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== nodes.size) {
    throw new CycleDetectedError('Cycle detected in graph');
  }

  return result;
}

export function hasCycle(edges: Edge[]): boolean {
  try {
    toposort(edges);
    return false;
  } catch (error) {
    if (error instanceof CycleDetectedError) {
      return true;
    }
    throw error;
  }
}

export function detectCycle(edges: Edge[]): Node[] | null {
  const graph = new Map<Node, Set<Node>>();
  const nodes = new Set<Node>();
  const color = new Map<Node, 'white' | 'gray' | 'black'>();
  const parent = new Map<Node, Node | null>();

  // Build graph
  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)!.add(to);
  }

  for (const node of nodes) {
    color.set(node, 'white');
    parent.set(node, null);
  }

  const dfs = (node: Node): Node[] | null => {
    color.set(node, 'gray');

    for (const neighbor of graph.get(node) || []) {
      if (color.get(neighbor) === 'gray') {
        // Back edge found - cycle exists
        const cycle: Node[] = [neighbor];
        let current: Node | null = node;
        while (current !== neighbor && current !== null) {
          cycle.unshift(current);
          current = parent.get(current) || null;
        }
        if (current === neighbor) {
          cycle.unshift(neighbor);
        }
        return cycle;
      }

      if (color.get(neighbor) === 'white') {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result) return result;
      }
    }

    color.set(node, 'black');
    return null;
  };

  for (const node of nodes) {
    if (color.get(node) === 'white') {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}