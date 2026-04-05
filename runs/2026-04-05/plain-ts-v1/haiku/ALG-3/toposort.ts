export class CycleDetectedError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleDetectedError";
  }
}

export interface Graph {
  nodes: string[];
  edges: Array<[string, string]>;
}

export interface ToposortResult {
  sorted: string[];
  hasCycle: boolean;
  cycle?: string[];
}

export function toposort(graph: Graph): ToposortResult {
  const { nodes, edges } = graph;

  // Build adjacency list and in-degree map
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize all nodes
  for (const node of nodes) {
    adjacencyList.set(node, []);
    inDegree.set(node, 0);
  }

  // Build graph from edges
  for (const [from, to] of edges) {
    if (!adjacencyList.has(from) || !adjacencyList.has(to)) {
      throw new Error("Edge references non-existent node");
    }
    adjacencyList.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  // Kahn's algorithm with cycle detection
  const queue: string[] = [];
  const sorted: string[] = [];
  const inDegreeCopy = new Map(inDegree);

  // Find all nodes with in-degree 0
  for (const node of nodes) {
    if (inDegreeCopy.get(node) === 0) {
      queue.push(node);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacencyList.get(current)!) {
      inDegreeCopy.set(neighbor, (inDegreeCopy.get(neighbor) ?? 0) - 1);
      if (inDegreeCopy.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = sorted.length !== nodes.length;

  if (hasCycle) {
    const cycle = findCycle(graph);
    return {
      sorted,
      hasCycle: true,
      cycle,
    };
  }

  return {
    sorted,
    hasCycle: false,
  };
}

function findCycle(graph: Graph): string[] | undefined {
  const { nodes, edges } = graph;
  const adjacencyList = new Map<string, string[]>();
  const visited = new Map<string, "white" | "gray" | "black">();
  const path: string[] = [];

  for (const node of nodes) {
    adjacencyList.set(node, []);
    visited.set(node, "white");
  }

  for (const [from, to] of edges) {
    adjacencyList.get(from)!.push(to);
  }

  for (const node of nodes) {
    if (visited.get(node) === "white") {
      const cyclePath = dfsVisit(node, adjacencyList, visited, []);
      if (cyclePath) {
        return cyclePath;
      }
    }
  }

  return undefined;
}

function dfsVisit(
  node: string,
  adjacencyList: Map<string, string[]>,
  visited: Map<string, "white" | "gray" | "black">,
  path: string[]
): string[] | undefined {
  visited.set(node, "gray");
  path.push(node);

  for (const neighbor of adjacencyList.get(node) ?? []) {
    const state = visited.get(neighbor);

    if (state === "gray") {
      // Found a cycle
      const cycleStart = path.indexOf(neighbor);
      return path.slice(cycleStart).concat(neighbor);
    }

    if (state === "white") {
      const result = dfsVisit(neighbor, adjacencyList, visited, [...path]);
      if (result) {
        return result;
      }
    }
  }

  visited.set(node, "black");
  return undefined;
}

export function toposortThrow(graph: Graph): string[] {
  const result = toposort(graph);
  if (result.hasCycle) {
    throw new CycleDetectedError(
      `Cycle detected: ${result.cycle?.join(" → ") ?? "unknown"}`
    );
  }
  return result.sorted;
}