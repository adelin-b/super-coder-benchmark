export class CycleError extends Error {
  constructor(message?: string) {
    super(message || "Cycle detected in topological sort");
    this.name = "CycleError";
    Object.setPrototypeOf(this, CycleError.prototype);
  }
}

export function toposort<T>(
  nodes: T[],
  edges: Array<[T, T]>
): T[] {
  if (nodes.length === 0) {
    return [];
  }

  const adjMap = new Map<T, T[]>();
  const nodeSet = new Set(nodes);

  for (const node of nodes) {
    adjMap.set(node, []);
  }

  for (const [from, to] of edges) {
    if (!nodeSet.has(from) || !nodeSet.has(to)) {
      throw new Error("Edge references node not in nodes list");
    }
    adjMap.get(from)!.push(to);
  }

  enum Color {
    White = 0,
    Gray = 1,
    Black = 2,
  }

  const color = new Map<T, Color>();
  for (const node of nodes) {
    color.set(node, Color.White);
  }

  const result: T[] = [];

  const visit = (node: T): void => {
    const nodeColor = color.get(node)!;

    if (nodeColor === Color.Gray) {
      throw new CycleError();
    }

    if (nodeColor === Color.Black) {
      return;
    }

    color.set(node, Color.Gray);

    const neighbors = adjMap.get(node) || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }

    color.set(node, Color.Black);
    result.push(node);
  };

  for (const node of nodes) {
    if (color.get(node) === Color.White) {
      visit(node);
    }
  }

  return result.reverse();
}