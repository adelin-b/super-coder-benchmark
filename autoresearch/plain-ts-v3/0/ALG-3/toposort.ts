export type Graph = Map<number, number[]>;

export class CycleError extends Error {
  constructor(message: string = "Cycle detected in graph") {
    super(message);
    this.name = "CycleError";
    Object.setPrototypeOf(this, CycleError.prototype);
  }
}

export function topologicalSort(graph: Graph): number[] {
  const result: number[] = [];
  const color = new Map<number, "white" | "gray" | "black">();

  // Initialize all nodes as white
  const nodes = new Set<number>();
  for (const [node] of graph) {
    nodes.add(node);
  }
  for (const edges of graph.values()) {
    for (const neighbor of edges) {
      nodes.add(neighbor);
    }
  }

  for (const node of nodes) {
    color.set(node, "white");
  }

  function dfs(node: number): void {
    color.set(node, "gray");

    const edges = graph.get(node) || [];
    for (const neighbor of edges) {
      const neighborColor = color.get(neighbor) || "white";

      if (neighborColor === "gray") {
        throw new CycleError(`Cycle detected at node ${neighbor}`);
      }

      if (neighborColor === "white") {
        dfs(neighbor);
      }
    }

    color.set(node, "black");
    result.unshift(node);
  }

  for (const node of nodes) {
    if (color.get(node) === "white") {
      dfs(node);
    }
  }

  return result;
}

export function hasCycle(graph: Graph): boolean {
  try {
    topologicalSort(graph);
    return false;
  } catch (e) {
    if (e instanceof CycleError) {
      return true;
    }
    throw e;
  }
}